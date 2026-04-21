// ==========================================
// THƯ MỤC: frontend/static/chart.js
// ==========================================
function initChart() {
    const canvas = getEl("mainChart");
    if(!canvas) return; 
    
    const context = canvas.getContext("2d");
    appState.chart = new Chart(context, {
        type: "scatter",
        data: {
            datasets: [
                { label: "Dữ liệu thực tế", data: [], backgroundColor: "rgba(18, 115, 105, 0.75)", borderColor: "rgba(11, 79, 73, 1)", borderWidth: 1, pointRadius: 6 },
                { label: "Đường dự đoán", data: [], type: "line", borderColor: "rgba(204, 95, 47, 1)", borderWidth: 3, pointRadius: 0, tension: 0, fill: false },
                { label: "Điểm dự đoán (Predict)", data: [], backgroundColor: "#e53e3e", borderColor: "#c53030", borderWidth: 2, pointRadius: 8, pointStyle: 'rectRot' }
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: "nearest", intersect: false },
            onClick: (event, elements, chart) => {
                if (!appState.isClickMode || appState.currentMode !== 'ml') return;
                const rawX = chart.scales.x.getValueForPixel(event.native ? event.native.offsetX : event.x);
                const rawY = chart.scales.y.getValueForPixel(event.native ? event.native.offsetY : event.y);
                const dataX = Math.round(rawX * 100) / 100; const dataY = Math.round(rawY * 100) / 100;

                if (!appState.columns.includes('Dữ liệu X (Click)')) {
                    appState.dataByColumn['Dữ liệu X (Click)'] = []; appState.dataByColumn['Dữ liệu Y (Click)'] = [];
                    appState.columns = ['Dữ liệu X (Click)', 'Dữ liệu Y (Click)'];
                    fillColumnSelect(getEl("xColumn"), appState.columns, 0); fillColumnSelect(getEl("yColumn"), appState.columns, 1);
                    if(getEl("configCard")) getEl("configCard").classList.remove("disabled");
                }

                appState.dataByColumn['Dữ liệu X (Click)'].push(dataX); appState.dataByColumn['Dữ liệu Y (Click)'].push(dataY);
                if(getEl('manualX')) getEl('manualX').value = appState.dataByColumn['Dữ liệu X (Click)'].join(', ');
                if(getEl('manualY')) getEl('manualY').value = appState.dataByColumn['Dữ liệu Y (Click)'].join(', ');

                if (appState.dataByColumn['Dữ liệu X (Click)'].length >= 2) trainRealtime();
                else {
                    chart.data.datasets[0].data = [{ x: dataX, y: dataY }];
                    chart.update('none'); updateStatus("Cần thêm 1 điểm nữa để vẽ đường thẳng.", "#d96f32");
                }
            },
            plugins: {
                legend: { position: "top", labels: { usePointStyle: true } },
                zoom: { pan: { enabled: true, mode: 'xy', onPanComplete: function({chart}) { extendGraphOnZoom(chart); } }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy', onZoomComplete: function({chart}) { extendGraphOnZoom(chart); } } }
            }
        }
    });
}

function resetChartCamera() {
    if (!appState.chart) return;
    const isML = appState.currentMode === 'ml';

    // Xóa tạm đường thẳng vô cực để tính toán khung nhìn
    if (appState.chart.data.datasets[1]) appState.chart.data.datasets[1].data = [];

    let minX = 0, maxX = 20, minY = 0, maxY = 20;

    if (isML) {
        // --- LOGIC CHO HỌC MÁY (Tự động ôm khít dữ liệu + 10% lề) ---
        const points = appState.chart.data.datasets[0].data;
        if (points.length > 0) {
            minX = points[0].x; maxX = points[0].x; minY = points[0].y; maxY = points[0].y;
            points.forEach(p => { 
                if (p.x < minX) minX = p.x; 
                if (p.x > maxX) maxX = p.x; 
                if (p.y < minY) minY = p.y; 
                if (p.y > maxY) maxY = p.y; 
            });
            // Thêm lề 10% để các điểm không dính sát vào viền màn hình
            const padX = (maxX - minX) * 0.1 || 1; 
            const padY = (maxY - minY) * 0.1 || 1;
            minX -= padX; maxX += padX; minY -= padY; maxY += padY;
        }
    } else {
        // --- LOGIC CHO TOÁN HỌC (Ép tỷ lệ 1:1 vuông vức) ---
        minX = -10; maxX = 10; minY = -10; maxY = 10; 
        
        const width = appState.chart.width || 800; 
        const height = appState.chart.height || 600;
        const canvasRatio = width / height;
        
        let spanX = maxX - minX; let spanY = maxY - minY;
        if (spanX === 0) spanX = 1; if (spanY === 0) spanY = 1;
        
        if ((spanX / spanY) < canvasRatio) {
            const diff = ((spanY * canvasRatio) - spanX) / 2; minX -= diff; maxX += diff;
        } else {
            const diff = ((spanX / canvasRatio) - spanY) / 2; minY -= diff; maxY += diff;
        }
    }

    // Áp dụng giới hạn mới vào Chart
    appState.chart.options.scales.x.min = minX; appState.chart.options.scales.x.max = maxX;
    appState.chart.options.scales.y.min = minY; appState.chart.options.scales.y.max = maxY;
    appState.chart.update('none');

    if (appState.chart.$zoom) appState.chart.$zoom._originalOptions = undefined; 
    if (typeof appState.chart.resetZoom === 'function') appState.chart.resetZoom('none');
    
    // Vẽ lại đường dự đoán/đường thẳng
    if (typeof extendGraphOnZoom === 'function') extendGraphOnZoom(appState.chart);
}

function extendGraphOnZoom(chart) {
    const x_min = chart.scales.x.min; const x_max = chart.scales.x.max;
    const step = (x_max - x_min) / (chart.width || 800);
    const startX = x_min - (x_max - x_min) * 0.5; const endX = x_max + (x_max - x_min) * 0.5;
    const lineData = [];

    if (appState.currentMode === 'math') {
        const mInput = getEl('mathInput');
        if (!mInput || !mInput.value) return;
        try {
            const compiled = math.compile(mInput.value);
            for (let x = startX; x <= endX; x += step) {
                const y = compiled.evaluate({ x: x });
                if (y && y.isComplex) lineData.push({ x: x, y: NaN }); 
                else lineData.push(isFinite(Number(y)) ? { x: x, y: Number(y) } : { x: x, y: NaN });
            }
        } catch (e) { return; }
    } else if (appState.currentMode === 'ml' && appState.mlModel.coefficients.length > 0) {
        const { coefficients, intercept, modelType } = appState.mlModel;
        for (let x = startX; x <= endX; x += step) {
            let y = intercept;
            if (modelType === 'linear') y += coefficients[0] * x;
            else coefficients.forEach((coef, i) => { y += coef * Math.pow(x, i + 1); });
            lineData.push({ x: x, y: y });
        }
    }
    
    if (chart.data.datasets[1]) { chart.data.datasets[1].data = lineData; chart.update('none'); }
}

function plotMathRealtime() {
    const mInput = getEl('mathInput');
    if (!mInput || !mInput.value || !appState.chart) return;
    try {
        math.compile(mInput.value); 
        appState.chart.data.datasets[0].data = []; appState.chart.data.datasets[1].data = []; appState.chart.data.datasets[2].data = [];
        appState.chart.options.scales.x.title = { display: true, text: "Trục X" };
        appState.chart.options.scales.y.title = { display: true, text: "f(x)" };
        resetChartCamera(); 
    } catch (err) { alert("Cú pháp toán không hợp lệ."); }
}