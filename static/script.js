// Trạng thái toàn cục của ứng dụng frontend.
const appState = {
    currentMode: 'ml',
    isClickMode: false,
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
    if (appState.columns.length === 0) return;

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

    if (appState.trainAbortController) appState.trainAbortController.abort();
    appState.trainAbortController = new AbortController();

    dom.statusText.textContent = "Đang huấn luyện mô hình...";
    dom.statusText.style.color = "#d96f32";

    try {
        const response = await fetch("/train", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x_data: xData, y_data: yData, model_type: modelType, degree }),
            signal: appState.trainAbortController.signal,
        });

        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Huấn luyện thất bại.");

        // LƯU THÔNG SỐ ĐỂ VẼ VÔ CỰC VÀ DỰ ĐOÁN
        appState.mlModel = {
            coefficients: payload.coefficients || [],
            intercept: payload.intercept || 0,
            modelType: modelType,
            degree: degree
        };

        // --- BẮT ĐẦU PHẦN CẬP NHẬT GIAO DIỆN MỚI ---
        // Làm tròn số giống ảnh (MSE 6 số, R2 4 số thập phân)
        const mse = payload.mse !== undefined ? payload.mse.toFixed(6) : "--";
        const r2 = (payload.r2 !== undefined ? payload.r2 : payload.r2_score) !== undefined ?
            (payload.r2 || payload.r2_score).toFixed(4) : "--";

        dom.mseValue.textContent = mse;
        dom.r2Value.textContent = r2;

        // Gọi hàm tạo chuỗi HTML phương trình để có số mũ đẹp mắt
        if (typeof formatEquationHTML === 'function') {
            const niceEquation = formatEquationHTML(appState.mlModel.intercept, appState.mlModel.coefficients, modelType);
            const mathEquationEl = document.getElementById('mathEquation');
            if (mathEquationEl) {
                mathEquationEl.innerHTML = `Phương trình hồi quy: ${niceEquation}`;
            }
        }

        // Vẫn giữ status text để báo hiệu trạng thái
        dom.statusText.textContent = "Đã cập nhật mô hình thành công.";
        dom.statusText.style.color = "#127369";
        // --- KẾT THÚC PHẦN CẬP NHẬT GIAO DIỆN MỚI ---

        const scatterData = xData.map((xValue, index) => ({ x: xValue, y: yData[index] }));

        let lineData = [];
        if (payload.line_data) {
            lineData = payload.line_data;
        } else if (payload.line_x && payload.line_y) {
            lineData = payload.line_x.map((xVal, idx) => ({ x: xVal, y: payload.line_y[idx] }));
        }

        updateChart(scatterData, lineData, xKey, yKey);
    } catch (error) {
        if (error.name === "AbortError") return;
        dom.statusText.textContent = "Có lỗi khi huấn luyện mô hình.";
        dom.statusText.style.color = "red";
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
                    pointRadius: 6, // Phóng to chấm tròn lên 1 chút để dễ click
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
                {
                    label: "Điểm dự đoán (Predict)",
                    data: [],
                    backgroundColor: "#e53e3e", // Màu đỏ nổi bật
                    borderColor: "#c53030",
                    borderWidth: 2,
                    pointRadius: 8, // Chấm to hơn bình thường
                    pointStyle: 'rectRot', // Hình thoi (viên kim cương)
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: {
                mode: "nearest",
                intersect: false,
            },

            // ==========================================
            // BẮT SỰ KIỆN CLICK CHUỘT (Đã vá lỗi)
            // ==========================================
            onClick: (event, elements, chart) => {
                if (!appState.isClickMode || appState.currentMode !== 'ml') return;

                // 1. Sửa lỗi tọa độ (Dùng native offset)
                const rawX = chart.scales.x.getValueForPixel(event.native ? event.native.offsetX : event.x);
                const rawY = chart.scales.y.getValueForPixel(event.native ? event.native.offsetY : event.y);

                const dataX = Math.round(rawX * 100) / 100;
                const dataY = Math.round(rawY * 100) / 100;

                // 2. Sửa lỗi đồng bộ: Kiểm tra bằng mảng columns thay vì dataByColumn
                if (!appState.columns.includes('Dữ liệu X (Click)')) {
                    appState.dataByColumn['Dữ liệu X (Click)'] = [];
                    appState.dataByColumn['Dữ liệu Y (Click)'] = [];
                    appState.columns = ['Dữ liệu X (Click)', 'Dữ liệu Y (Click)'];
                    fillColumnSelect(dom.xColumn, appState.columns, 0);
                    fillColumnSelect(dom.yColumn, appState.columns, 1);
                    dom.configCard.classList.remove("disabled");
                }

                // Push điểm mới
                appState.dataByColumn['Dữ liệu X (Click)'].push(dataX);
                appState.dataByColumn['Dữ liệu Y (Click)'].push(dataY);

                document.getElementById('manualX').value = appState.dataByColumn['Dữ liệu X (Click)'].join(', ');
                document.getElementById('manualY').value = appState.dataByColumn['Dữ liệu Y (Click)'].join(', ');

                if (appState.dataByColumn['Dữ liệu X (Click)'].length >= 2) {
                    trainRealtime();
                } else {
                    // 3. Sửa lỗi nhảy Camera: Vẽ trực tiếp không thông qua updateChart
                    chart.data.datasets[0].data = [{ x: dataX, y: dataY }];
                    chart.data.datasets[1].data = [];
                    chart.update('none');
                    dom.statusText.textContent = "Cần thêm 1 điểm nữa để vẽ đường thẳng.";
                }
            },

            plugins: {
                legend: { position: "top", labels: { usePointStyle: true } },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'xy',
                        onPanStart: function ({ chart }) {
                            // Khóa Pan khi đang ở chế độ vẽ
                            if (appState.isClickMode) return false;
                            const hasData = chart.data.datasets[0].data.length > 0 || chart.data.datasets[1].data.length > 0;
                            if (!hasData) return false;
                        },
                        onPanComplete: function ({ chart }) { extendGraphOnZoom(chart); }
                    },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'xy',
                        onZoomStart: function ({ chart }) {
                            const hasData = chart.data.datasets[0].data.length > 0 || chart.data.datasets[1].data.length > 0;
                            if (!hasData) return false;
                        },
                        onZoomComplete: function ({ chart }) { extendGraphOnZoom(chart); }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: "Trục X", color: "#1d2b2a", font: { weight: "700" } }, grid: { color: "rgba(22, 55, 53, 0.08)" } },
                y: { title: { display: true, text: "Trục Y", color: "#1d2b2a", font: { weight: "700" } }, grid: { color: "rgba(22, 55, 53, 0.08)" } },
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
    // Đã xóa 'sample' khỏi 2 biến này
    const sections = { 'csv': 'modeCSV', 'manual': 'modeManual' };
    const buttons = { 'csv': 'btnModeCSV', 'manual': 'btnModeManual' };

    Object.keys(sections).forEach(key => {
        const sec = document.getElementById(sections[key]);
        const btn = document.getElementById(buttons[key]);
        if (sec && btn) {
            sec.style.display = (key === mode) ? 'block' : 'none';
            btn.className = (key === mode) ? 'tab-btn tab-active' : 'tab-btn tab-inactive';
        }
    });
}
// Biến trạng thái theo dõi xem người dùng có đang bật chế độ Click đồ thị không
appState.isClickMode = false;

function toggleClickMode() {
    appState.isClickMode = !appState.isClickMode;
    const btn = document.getElementById('btnToggleClick');

    if (appState.isClickMode) {
        btn.textContent = "🔴 Đang bật (Click để tắt)";
        btn.style.backgroundColor = "#d96f32";

        // Cập nhật trục thành 0-20 nếu biểu đồ đang trống
        if (!appState.chart.data.datasets[0].data.length) {
            appState.chart.options.scales.x.min = 0;
            appState.chart.options.scales.x.max = 20; // Tăng lên 20
            appState.chart.options.scales.y.min = 0;
            appState.chart.options.scales.y.max = 20;
            appState.chart.update('none');
        }

        if (appState.chart.options.plugins.zoom) {
            appState.chart.options.plugins.zoom.pan.enabled = false;
        }
    } else {
        btn.textContent = "🖱️ Bật chế độ Click tạo điểm";
        btn.style.backgroundColor = "#4a5568";

        if (appState.chart.options.plugins.zoom) {
            appState.chart.options.plugins.zoom.pan.enabled = true;
        }
    }
}

function clearManualData() {
    // 1. Xóa sạch dữ liệu trong State và Input
    appState.dataByColumn = {};
    appState.columns = [];
    document.getElementById('manualX').value = "";
    document.getElementById('manualY').value = "";

    document.getElementById('predictX').value = "";
    document.getElementById('predictResultBox').style.display = 'none';
    // 2. TẮT LỖI HIỂN THỊ: Đưa các chỉ số đánh giá về mặc định
    document.getElementById('mseValue').textContent = "--";
    document.getElementById('r2Value').textContent = "--";

    // 3. Xóa dữ liệu trực tiếp trên Chart và ép lại lưới tọa độ MỚI
    if (appState.chart) {
        // Xóa các điểm trên màn hình
        appState.chart.data.datasets[0].data = [];
        appState.chart.data.datasets[1].data = [];

        // Đặt lại lưới rộng hơn (Ví dụ: 0 đến 20 để có nhiều không gian click)
        appState.chart.options.scales.x.min = 0;
        appState.chart.options.scales.x.max = 20;
        appState.chart.options.scales.y.min = 0;
        appState.chart.options.scales.y.max = 20;

        appState.chart.update('none'); // Update mà không có animation
    }

    dom.statusText.textContent = "Đã xóa dữ liệu. Hãy click lên đồ thị để thêm điểm mới.";
    dom.statusText.style.color = "#127369";
}
// ==========================================
// TÍNH NĂNG: DỰ ĐOÁN Y DỰA TRÊN X
// ==========================================
function predictY() {
    const xInput = document.getElementById('predictX').value;
    const xVal = parseFloat(xInput);

    // 1. Kiểm tra đầu vào và mô hình
    if (isNaN(xVal)) return alert("Vui lòng nhập một số hợp lệ cho trục X.");

    const model = appState.mlModel;
    if (!model || model.coefficients.length === 0) {
        return alert("Chưa có mô hình. Vui lòng tải dữ liệu và huấn luyện trước!");
    }

    // 2. Lấy thông số phương trình toán học
    const coeffs = model.coefficients;
    const intercept = model.intercept;
    let yVal = intercept;
    let equationText = `y = ${intercept.toFixed(2)}`;

    // 3. Tính toán dựa trên loại mô hình (Linear hoặc Polynomial)
    if (model.modelType === 'linear') {
        yVal += coeffs[0] * xVal;
        equationText += ` + (${coeffs[0].toFixed(2)} * X)`;
    } else {
        // Nếu là đa thức bậc 2, 3...
        coeffs.forEach((coef, i) => {
            const power = i + 1;
            yVal += coef * Math.pow(xVal, power);
            equationText += ` + (${coef.toFixed(2)} * X^${power})`;
        });
    }

    // 4. Hiển thị kết quả ra giao diện
    document.getElementById('predictResultBox').style.display = 'block';
    document.getElementById('predictEquation').textContent = `Công thức: ${equationText}`;
    document.getElementById('predictValue').textContent = `=> Y = ${yVal.toFixed(4)}`;

    // 5. Vẽ điểm dự đoán (Hình thoi đỏ) lên Chart.js
    if (appState.chart) {
        appState.chart.data.datasets[2].data = [{ x: xVal, y: yVal }];
        appState.chart.update('none'); // Update không animation để đỡ giật
    }
}
// Hàm chuyển đổi hệ số thành chuỗi phương trình HTML đẹp mắt
function formatEquationHTML(intercept, coeffs, modelType) {
    // Làm tròn số giống hệt ảnh bạn gửi (4 chữ số thập phân)
    let eq = `<i>y</i> = ${intercept.toFixed(4)}`;

    if (coeffs.length === 0) return eq;

    if (modelType === 'linear') {
        const sign = coeffs[0] >= 0 ? '+' : '-';
        eq += ` ${sign} ${Math.abs(coeffs[0]).toFixed(4)}<i>x</i>`;
    } else {
        // Xử lý hiển thị Đa thức
        coeffs.forEach((coef, index) => {
            const power = index + 1;
            const sign = coef >= 0 ? '+' : '-';
            const absCoef = Math.abs(coef).toFixed(4);

            if (power === 1) {
                eq += ` ${sign} ${absCoef}<i>x</i>`; // Bậc 1 không có mũ
            } else {
                eq += ` ${sign} ${absCoef}<i>x</i><sup>${power}</sup>`; // Bậc 2 trở lên dùng <sup>
            }
        });
    }
    return eq;
}
// ==========================================
// TÍNH NĂNG: XÓA TOÀN BỘ DỮ LIỆU & ĐỒ THỊ
// ==========================================
function clearAllData() {
    // 1. Xóa sạch bộ nhớ toàn cục
    appState.columns = [];
    appState.dataByColumn = {};
    appState.mlModel = {
        coefficients: [],
        intercept: 0,
        modelType: 'linear',
        degree: 1
    };

    // 2. Trả giao diện về trạng thái ban đầu
    const uploadInfo = document.getElementById('uploadInfo');
    if (uploadInfo) uploadInfo.textContent = "Chưa có dữ liệu.";

    const statusText = document.getElementById('statusText');
    if (statusText) {
        statusText.textContent = "Đã xóa toàn bộ đồ thị và dữ liệu.";
        statusText.style.color = "#d96f32";
    }

    // Reset Dropdown và khóa khu vực cấu hình
    document.getElementById('xColumn').innerHTML = "";
    document.getElementById('yColumn').innerHTML = "";
    document.getElementById('configCard').classList.add('disabled');

    // Reset Bảng Đánh giá & Dự đoán
    document.getElementById('mseValue').textContent = "--";
    document.getElementById('r2Value').textContent = "--";
    const mathEq = document.getElementById('mathEquation');
    if (mathEq) mathEq.innerHTML = "Phương trình hồi quy: <i>y</i> = ...";

    const predictBox = document.getElementById('predictValue');
    if (predictBox) predictBox.style.display = 'none';

    // Xóa trắng các ô nhập số
    ['manualX', 'manualY', 'predictX', 'mathInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // 3. Xóa các nét vẽ trên Chart.js và mở lại khung hình rộng
    if (appState.chart) {
        appState.chart.data.datasets[0].data = []; // Xóa điểm thực tế
        appState.chart.data.datasets[1].data = []; // Xóa đường dự đoán
        if (appState.chart.data.datasets[2]) {
            appState.chart.data.datasets[2].data = []; // Xóa điểm dự đoán (ngôi sao đỏ)
        }

        // Trả lưới tọa độ về 0-20 mặc định cho thoáng
        appState.chart.options.scales.x.min = 0;
        appState.chart.options.scales.x.max = 20;
        appState.chart.options.scales.y.min = 0;
        appState.chart.options.scales.y.max = 20;

        // Cập nhật lại trục nhưng không có hiệu ứng (chống giật)
        appState.chart.update('none');
    }
}
// Hàm tạo sự kiện xác nhận trước khi xóa
function requestClearAll() {
    const isConfirmed = confirm("⚠️ Bạn có chắc chắn muốn xóa toàn bộ dữ liệu và đồ thị không?\n\nMọi thông số cấu hình và tọa độ điểm sẽ bị mất sạch.");
    if (isConfirmed) {
        clearAllData();
    }
}