// Trạng thái toàn cục của ứng dụng frontend.
const appState = {
    currentMode: 'ml',
    chart: null,
    columns: [],
    dataByColumn: {},
    // Thêm phần lưu trữ thông số mô hình học máy
    mlModel: {
        coefficients: [],
        intercept: 0,
        modelType: 'linear',
        degree: 1
    }
};
// Gom toàn bộ tham chiếu DOM để truy cập nhanh và tránh lặp selector.
const dom = {
    csvFileInput: document.getElementById("csvFileInput"),
    uploadBtn: document.getElementById("uploadBtn"),
    uploadInfo: document.getElementById("uploadInfo"),
    configCard: document.getElementById("configCard"),
    xColumn: document.getElementById("xColumn"),
    yColumn: document.getElementById("yColumn"),
    modelType: document.getElementById("modelType"),
    degreeGroup: document.getElementById("degreeGroup"),
    degreeSlider: document.getElementById("degreeSlider"),
    degreeValue: document.getElementById("degreeValue"),
    mseValue: document.getElementById("mseValue"),
    r2Value: document.getElementById("r2Value"),
    statusText: document.getElementById("statusText"),
};

// Khởi tạo ứng dụng ngay khi script được tải.
bootstrap();

function bootstrap() {
    initChart();

    dom.uploadBtn.addEventListener("click", uploadCsvFile);
    dom.xColumn.addEventListener("change", trainRealtime);
    dom.yColumn.addEventListener("change", trainRealtime);
    dom.modelType.addEventListener("change", () => {
        syncDegreeVisibility();
        trainRealtime();
    });

    // Sự kiện input cho slider giúp mô hình train lại liên tục khi người dùng kéo.
    dom.degreeSlider.addEventListener("input", () => {
        dom.degreeValue.textContent = dom.degreeSlider.value;
        trainRealtime();
    });

    syncDegreeVisibility();
}

async function uploadCsvFile() {
    const file = dom.csvFileInput.files[0];
    if (!file) {
        alert("Vui lòng chọn file CSV trước khi tải lên.");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    dom.statusText.textContent = "Đang upload và xử lý dữ liệu...";

    try {
        const response = await fetch("/upload", {
            method: "POST",
            body: formData,
        });

        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.detail || "Upload thất bại.");
        }

        appState.dataByColumn = payload.data;
        appState.columns = payload.columns;

        if (appState.columns.length < 2) {
            throw new Error("Cần tối thiểu 2 cột số để chọn trục X và Y.");
        }

        fillColumnSelect(dom.xColumn, appState.columns, 0);
        fillColumnSelect(dom.yColumn, appState.columns, 1);

        dom.configCard.classList.remove("disabled");
        dom.uploadInfo.textContent = `Đã xử lý: ${payload.filename} | Số dòng hợp lệ: ${payload.rows}`;
        dom.statusText.textContent = "Dữ liệu đã sẵn sàng. Đang huấn luyện mô hình...";

        trainRealtime();
    } catch (error) {
        dom.statusText.textContent = "Có lỗi khi xử lý file CSV.";
        alert(error.message || "Không thể xử lý file CSV.");
    }
}

function fillColumnSelect(selectElement, columns, defaultIndex) {
    selectElement.innerHTML = "";

    columns.forEach((columnName) => {
        const option = document.createElement("option");
        option.value = columnName;
        option.textContent = columnName;
        selectElement.appendChild(option);
    });

    // Nếu index vượt giới hạn thì fallback về cột đầu.
    const safeIndex = Math.min(defaultIndex, columns.length - 1);
    selectElement.value = columns[safeIndex];
}

function syncDegreeVisibility() {
    if (dom.modelType.value === "polynomial") {
        dom.degreeGroup.classList.remove("hidden");
    } else {
        dom.degreeGroup.classList.add("hidden");
    }
}

async function trainRealtime() {
    if (appState.columns.length === 0) {
        return;
    }

    const xKey = dom.xColumn.value;
    const yKey = dom.yColumn.value;
    const modelType = dom.modelType.value;
    const degree = Number(dom.degreeSlider.value);

    const xData = appState.dataByColumn[xKey] || [];
    const yData = appState.dataByColumn[yKey] || [];

    if (xData.length !== yData.length || xData.length < 2) {
        dom.statusText.textContent = "Dữ liệu không đủ để huấn luyện.";
        return;
    }

    // Hủy request train trước đó nếu người dùng thao tác liên tục.
    if (appState.trainAbortController) {
        appState.trainAbortController.abort();
    }
    appState.trainAbortController = new AbortController();

    dom.statusText.textContent = "Đang huấn luyện mô hình...";

    try {
        const response = await fetch("/train", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                x_data: xData,
                y_data: yData,
                model_type: modelType,
                degree,
            }),
            signal: appState.trainAbortController.signal,
        });

        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.detail || "Huấn luyện thất bại.");
        }

        dom.mseValue.textContent = String(payload.mse);
        dom.r2Value.textContent = String(payload.r2);
        dom.statusText.textContent = "Mô hình đã cập nhật theo cấu hình mới nhất.";

        const scatterData = xData.map((xValue, index) => ({
            x: xValue,
            y: yData[index],
        }));

        const lineData = payload.line_x.map((lineX, index) => ({
            x: lineX,
            y: payload.line_y[index],
        }));

        updateChart(scatterData, lineData, xKey, yKey);
    } catch (error) {
        // Bỏ qua lỗi abort vì đây là hành vi bình thường khi kéo slider liên tục.
        if (error.name === "AbortError") {
            return;
        }

        dom.statusText.textContent = "Có lỗi khi huấn luyện mô hình.";
        console.error(error);
    }
}

function initChart() {
    const context = document.getElementById("mainChart").getContext("2d");

    appState.chart = new Chart(context, {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "Dữ liệu thực tế",
                    data: [],
                    backgroundColor: "rgba(18, 115, 105, 0.75)",
                    borderColor: "rgba(11, 79, 73, 1)",
                    borderWidth: 1,
                    pointRadius: 4,
                },
                {
                    label: "Đường dự đoán",
                    data: [],
                    type: "line",
                    borderColor: "rgba(204, 95, 47, 1)",
                    backgroundColor: "rgba(204, 95, 47, 1)",
                    borderWidth: 3,
                    pointRadius: 0,
                    tension: 0,
                    fill: false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // Tắt animation để kéo slider mượt và không bị giật.
            animation: false,
            interaction: {
                mode: "nearest",
                intersect: false,
            },
            plugins: {
                legend: {
                    position: "top",
                    labels: { usePointStyle: true },
                },
                zoom: {
                    pan: {
                        enabled: true, 
                        mode: 'xy',
                        onPanStart: function({chart}) {
                            // Trạm kiểm soát: Nếu mảng dữ liệu rỗng -> Hủy thao tác kéo (return false)
                            const hasData = chart.data.datasets[0].data.length > 0 || chart.data.datasets[1].data.length > 0;
                            if (!hasData) return false; 
                        },
                        onPanComplete: function({chart}) { extendGraphOnZoom(chart); }
                    },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'xy',
                        onZoomStart: function({chart}) {
                            // Trạm kiểm soát: Nếu mảng dữ liệu rỗng -> Hủy thao tác lăn chuột (return false)
                            const hasData = chart.data.datasets[0].data.length > 0 || chart.data.datasets[1].data.length > 0;
                            if (!hasData) return false; 
                        },
                        onZoomComplete: function({chart}) { extendGraphOnZoom(chart); }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Trục X",
                        color: "#1d2b2a",
                        font: { weight: "700" },
                    },
                    grid: {
                        color: "rgba(22, 55, 53, 0.08)",
                    },
                },
                y: {
                    title: {
                        display: true,
                        text: "Trục Y",
                        color: "#1d2b2a",
                        font: { weight: "700" },
                    },
                    grid: {
                        color: "rgba(22, 55, 53, 0.08)",
                    },
                },
            },
        },
    });
}

function updateChart(scatterData, lineData, xLabel, yLabel) {
    if (!appState.chart) return;

    // 1. Cập nhật dữ liệu
    appState.chart.data.datasets[0].data = scatterData;
    appState.chart.data.datasets[1].data = lineData;
    appState.chart.options.scales.x.title.text = xLabel;
    appState.chart.options.scales.y.title.text = yLabel;

    // 2. TẮT CHỨC NĂNG ZOOM NẾU CHƯA CÓ DỮ LIỆU
    const hasData = scatterData.length > 0 || lineData.length > 0;
    if (appState.chart.options.plugins.zoom) {
        const zoomOpts = appState.chart.options.plugins.zoom;
        zoomOpts.pan.enabled = hasData;
        zoomOpts.zoom.wheel.enabled = hasData;
        zoomOpts.zoom.pinch.enabled = hasData;
    }

    // 3. Tự động căn chỉnh lại Camera 
    resetChartCamera();
}
function resetChartCamera() {
    if (!appState.chart) return;
    
    // 1. Xóa bỏ toàn bộ giới hạn bị kẹt do Zoom/Pan
    delete appState.chart.options.scales.x.min;
    delete appState.chart.options.scales.x.max;
    delete appState.chart.options.scales.y.min;
    delete appState.chart.options.scales.y.max;
    
    // 2. Ép Chart.js tính toán lại khung nhìn dựa trên dữ liệu hiện tại
    appState.chart.update();
    
    // 3. Đặt trạng thái này làm "Góc nhìn gốc" cho plugin Zoom
    if (typeof appState.chart.resetZoom === 'function') {
        appState.chart.resetZoom();
    }
}
function switchMode(mode) {
    appState.currentMode = mode;
    
    const mlSec = document.getElementById('mlSection');
    const mathSec = document.getElementById('mathSection');
    const tabML = document.getElementById('tabML');
    const tabMath = document.getElementById('tabMath');

    if (mode === 'ml') {
        mlSec.style.display = 'block';
        mathSec.style.display = 'none';
        
        tabML.className = 'tab-btn tab-active';
        tabMath.className = 'tab-btn tab-inactive';
        
        // Vẽ lại đồ thị ML nếu đã có data
        if (appState.columns.length > 0) {
            trainRealtime();
        } else {
            // Xóa trắng chart nếu chưa có data
            updateChart([], [], "Trục X", "Trục Y");
        }
    } else {
        mlSec.style.display = 'none';
        mathSec.style.display = 'block';
        
        tabMath.className = 'tab-btn tab-active';
        tabML.className = 'tab-btn tab-inactive';
        
        // Gọi hàm vẽ đồ thị toán học
        plotMathRealtime();
    }
}

function plotMathRealtime() {
    const mathInput = document.getElementById('mathInput').value;
    if (!mathInput) return;

    try {
        const compiled = math.compile(mathInput);
        
        // Lấy mẫu từ -10 đến 10
        const x_min = -10;
        const x_max = 10;
        const num_points = 300;
        const step = (x_max - x_min) / num_points;

        const lineData = [];
        for (let x = x_min; x <= x_max; x += step) {
            const y = compiled.evaluate({ x: x });
            if (isFinite(y)) {
                lineData.push({ x: x, y: y });
            }
        }

        // Truyền mảng rỗng [] cho dữ liệu Scatter, chỉ hiển thị đường Line
        updateChart([], lineData, "Trục X", "f(x) = " + mathInput);
        dom.statusText.textContent = "Đã vẽ hàm số thành công!";

    } catch (err) {
        console.error(err);
        alert("Cú pháp toán học không hợp lệ. Vui lòng kiểm tra lại (VD: dùng 'x^2' thay vì 'x2').");
    }
}

// Lắng nghe sự kiện "Enter" để vẽ ngay khi gõ xong
document.getElementById('mathInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        plotMathRealtime();
    }
});

// Hàm đọc và áp dụng dữ liệu người dùng tự nhập
function applyManualData() {
    const strX = document.getElementById('manualX').value;
    const strY = document.getElementById('manualY').value;

    // Phân tách chuỗi bằng dấu phẩy, loại bỏ khoảng trắng và chuyển thành số thực (float)
    const arrX = strX.split(',').map(item => parseFloat(item.trim())).filter(n => !isNaN(n));
    const arrY = strY.split(',').map(item => parseFloat(item.trim())).filter(n => !isNaN(n));

    // Kiểm tra tính hợp lệ của dữ liệu
    if (arrX.length === 0 || arrY.length === 0) {
        alert("Vui lòng nhập dữ liệu số hợp lệ!");
        return;
    }
    if (arrX.length !== arrY.length) {
        alert(`Lỗi: Số lượng phần tử không khớp! (X có ${arrX.length} số, Y có ${arrY.length} số)`);
        return;
    }
    if (arrX.length < 2) {
        alert("Cần tối thiểu 2 điểm dữ liệu để huấn luyện mô hình.");
        return;
    }

    // Đưa dữ liệu thủ công vào State toàn cục của ứng dụng
    appState.dataByColumn = {
        'Dữ liệu X (Nhập tay)': arrX,
        'Dữ liệu Y (Nhập tay)': arrY
    };
    appState.columns = ['Dữ liệu X (Nhập tay)', 'Dữ liệu Y (Nhập tay)'];

    // Đổ dữ liệu vào Dropdown
    fillColumnSelect(dom.xColumn, appState.columns, 0);
    fillColumnSelect(dom.yColumn, appState.columns, 1);

    // Mở khóa khu vực cấu hình
    dom.configCard.classList.remove("disabled");
    
    // Cập nhật trạng thái
    dom.uploadInfo.textContent = `Đã áp dụng dữ liệu thủ công: ${arrX.length} điểm.`;
    dom.statusText.textContent = "Dữ liệu đã sẵn sàng. Đang huấn luyện...";

    // Kích hoạt hàm Train
    trainRealtime();
}
// ==========================================
// TÍNH NĂNG: ZOOM VÀ KÉO DÀI ĐỒ THỊ (INFINITE PAN/ZOOM)
// ==========================================

// ==========================================
// TÍNH NĂNG ZOOM VÀ KÉO DÀI ĐỒ THỊ TOÁN HỌC
// ==========================================
// ==========================================
// TÍNH NĂNG ZOOM VÀ KÉO DÀI ĐỒ THỊ TOÁN HỌC (NÂNG CẤP)
// ==========================================

function extendGraphOnZoom(chart) {
    const x_min = chart.scales.x.min;
    const x_max = chart.scales.x.max;
    const range = x_max - x_min;
    const padding = range * 0.5;
    const startX = x_min - padding;
    const endX = x_max + padding;
    const numPoints = chart.width || 800;
    const step = (endX - startX) / numPoints;
    const lineData = [];

    if (appState.currentMode === 'math') {
        const mathInput = document.getElementById('mathInput').value;
        if (!mathInput || mathInput.includes(',')) return;
        try {
            const compiled = math.compile(mathInput);
            for (let x = startX; x <= endX; x += step) {
                const y = compiled.evaluate({ x: x });
                lineData.push(isFinite(y) ? { x: x, y: y } : { x: x, y: NaN });
            }
        } catch (e) { return; }
    } 
    else if (appState.currentMode === 'ml' && appState.mlModel.coefficients.length > 0) {
        // Tính toán đường dự đoán dựa trên hệ số mô hình đã lưu
        const { coefficients, intercept, modelType, degree } = appState.mlModel;
        
        for (let x = startX; x <= endX; x += step) {
            let y = intercept;
            if (modelType === 'linear') {
                y += coefficients[0] * x;
            } else {
                // Tính đa thức: intercept + c0*x^1 + c1*x^2 + ...
                coefficients.forEach((coef, i) => {
                    y += coef * Math.pow(x, i + 1);
                });
            }
            lineData.push({ x: x, y: y });
        }
    }

    if (chart.data.datasets[1] && lineData.length > 0) {
        chart.data.datasets[1].data = lineData;
        chart.update('none');
    }
}
function loadSampleData() {
    // 1. Định nghĩa tập dữ liệu mẫu (Bạn có thể đổi sang các số khác)
    const sampleData = {
        "Quảng cáo (triệu VNĐ)": [10, 20, 30, 45, 50, 60, 75, 80, 95, 110, 120, 135],
        "Doanh thu (triệu VNĐ)": [25, 48, 62, 95, 105, 120, 155, 168, 195, 220, 245, 270]
    };

    // 2. Đưa vào State
    appState.dataByColumn = sampleData;
    appState.columns = Object.keys(sampleData);

    // 3. Đổ dữ liệu vào các Select box
    fillColumnSelect(dom.xColumn, appState.columns, 0);
    fillColumnSelect(dom.yColumn, appState.columns, 1);

    // 4. Mở khóa giao diện cấu hình
    dom.configCard.classList.remove("disabled");
    
    // 5. Thông báo trạng thái và tự động Train
    dom.uploadInfo.textContent = "Đã nạp dữ liệu mẫu thành công!";
    dom.statusText.textContent = "Dữ liệu mẫu sẵn sàng. Đang huấn luyện...";
    
    // Chuyển sang Tab ML để người dùng thấy kết quả ngay
    if (typeof switchMode === 'function') switchMode('ml');
    
    trainRealtime();
}


// Hàm chuyển đổi giao diện giữa "Tải CSV" và "Nhập tay"
// 1. HÀM CHUYỂN ĐỔI TAB NHẬP LIỆU (Đã nâng cấp hỗ trợ 3 Tab)
function setInputMode(mode) {
    const sections = {
        'csv': document.getElementById('modeCSV'),
        'manual': document.getElementById('modeManual'),
        'sample': document.getElementById('modeSample') // Đã thêm tab Sample
    };
    const buttons = {
        'csv': document.getElementById('btnModeCSV'),
        'manual': document.getElementById('btnModeManual'),
        'sample': document.getElementById('btnModeSample') // Đã thêm nút Sample
    };

    // Duyệt qua cả 3 tab, tab nào được chọn thì hiện, còn lại ẩn đi
    Object.keys(sections).forEach(key => {
        if (sections[key] && buttons[key]) {
            sections[key].style.display = (key === mode) ? 'block' : 'none';
            buttons[key].className = (key === mode) ? 'tab-btn tab-active' : 'tab-btn tab-inactive';
        }
    });
}
