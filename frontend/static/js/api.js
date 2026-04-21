// ==========================================
// THƯ MỤC: frontend/static/api.js
// ==========================================
async function uploadCsvFile() {
    const fileInput = getEl("csvFileInput");
    if (!fileInput || !fileInput.files[0]) return alert("Vui lòng chọn file CSV!");

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    updateStatus("Đang upload và xử lý dữ liệu...", "#d96f32");

    try {
        const response = await fetch("/upload", { method: "POST", body: formData });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Upload thất bại.");

        appState.dataByColumn = payload.data;
        appState.columns = payload.columns;
        
        fillColumnSelect(getEl("xColumn"), appState.columns, 0);
        fillColumnSelect(getEl("yColumn"), appState.columns, 1);
        
        if(getEl("configCard")) getEl("configCard").classList.remove("disabled");
        if(getEl("uploadInfo")) getEl("uploadInfo").textContent = `Đã xử lý: ${payload.filename} | Số dòng: ${payload.rows}`;
        
        trainRealtime();
    } catch (error) {
        alert(error.message || "Không thể xử lý file CSV.");
        updateStatus("Lỗi khi tải file.", "red");
    }
}

async function trainRealtime() {
    if (appState.columns.length === 0) return;
    
    const xKey = getEl("xColumn").value; const yKey = getEl("yColumn").value;
    const modelType = getEl("modelType").value; const degree = Number(getEl("degreeSlider").value);
    const xData = appState.dataByColumn[xKey] || []; const yData = appState.dataByColumn[yKey] || [];

    if (xData.length !== yData.length || xData.length < 2) return;

    if (appState.trainAbortController) appState.trainAbortController.abort();
    appState.trainAbortController = new AbortController();
    updateStatus("Đang huấn luyện mô hình...", "#d96f32");

    try {
        const response = await fetch("/train", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x_data: xData, y_data: yData, model_type: modelType, degree }),
            signal: appState.trainAbortController.signal,
        });

        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Huấn luyện thất bại.");

        appState.mlModel = { coefficients: payload.coefficients || [], intercept: payload.intercept || 0, modelType: modelType, degree: degree };

        if(getEl('mseValue')) getEl('mseValue').textContent = payload.mse !== undefined ? payload.mse.toFixed(6) : "--"; 
        if(getEl('r2Value')) getEl('r2Value').textContent = (payload.r2 !== undefined ? payload.r2 : payload.r2_score) !== undefined ? (payload.r2 || payload.r2_score).toFixed(4) : "--";
        const mathEq = getEl('mathEquation');
        if (mathEq) mathEq.innerHTML = `Phương trình hồi quy: ${formatEquationHTML(appState.mlModel.intercept, appState.mlModel.coefficients, modelType)}`;

        updateStatus("Đã cập nhật mô hình thành công.", "#127369");

        const scatterData = xData.map((val, idx) => ({ x: val, y: yData[idx] }));
        let lineData = payload.line_data || (payload.line_x ? payload.line_x.map((x, idx) => ({ x: x, y: payload.line_y[idx] })) : []);

        if (appState.chart) {
            appState.chart.data.datasets[0].data = scatterData;
            appState.chart.data.datasets[1].data = lineData;
            appState.chart.data.datasets[2].data = [];
            resetChartCamera();
        }
    } catch (error) {
        if (error.name !== "AbortError") updateStatus("Có lỗi khi huấn luyện mô hình.", "red");
    }
}