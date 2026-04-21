// ==========================================
// THƯ MỤC: frontend/static/ui.js
// ==========================================
function bootstrap() {
    initChart();
    
    const btnUpload = getEl("uploadBtn");
    if(btnUpload) btnUpload.addEventListener("click", uploadCsvFile);
    
    const xCol = getEl("xColumn"); const yCol = getEl("yColumn");
    if(xCol) xCol.addEventListener("change", trainRealtime);
    if(yCol) yCol.addEventListener("change", trainRealtime);
    
    const modType = getEl("modelType");
    if(modType) modType.addEventListener("change", () => { syncDegreeVisibility(); trainRealtime(); });
    
    const degSlider = getEl("degreeSlider");
    if(degSlider) degSlider.addEventListener("input", () => {
        const degVal = getEl("degreeValue"); if(degVal) degVal.textContent = degSlider.value;
        trainRealtime();
    });
    
    const mInput = getEl('mathInput');
    if(mInput) { mInput.addEventListener('keypress', function (e) { if (e.key === 'Enter') plotMathRealtime(); }); }

    syncDegreeVisibility();
}

function setInputMode(mode) {
    const sections = { 'csv': 'modeCSV', 'manual': 'modeManual' };
    const buttons = { 'csv': 'btnModeCSV', 'manual': 'btnModeManual' };
    Object.keys(sections).forEach(key => {
        const sec = getEl(sections[key]); const btn = getEl(buttons[key]);
        if (sec && btn) {
            sec.style.display = (key === mode) ? 'block' : 'none';
            btn.className = (key === mode) ? 'tab-btn tab-active' : 'tab-btn tab-inactive';
        }
    });
}

function toggleClickMode() {
    appState.isClickMode = !appState.isClickMode;
    const btn = getEl('btnToggleClick');
    if (!btn || !appState.chart) return;
    
    if (appState.isClickMode) {
        btn.innerHTML = "🔴 Đang bật (Click để tắt)"; btn.style.backgroundColor = "#127369"; 
        if (appState.chart.data.datasets[0].data.length === 0) resetChartCamera();
        if (appState.chart.options.plugins.zoom) appState.chart.options.plugins.zoom.pan.enabled = false;
    } else {
        btn.innerHTML = "🖱️ Bật chế độ Click tạo điểm"; btn.style.backgroundColor = "#4a5568";
        if (appState.chart.options.plugins.zoom) appState.chart.options.plugins.zoom.pan.enabled = true;
    }
}

function applyManualData() {
    const mx = getEl('manualX'); const my = getEl('manualY');
    if(!mx || !my) return;
    const arrX = mx.value.split(',').map(i => parseFloat(i.trim())).filter(n => !isNaN(n));
    const arrY = my.value.split(',').map(i => parseFloat(i.trim())).filter(n => !isNaN(n));
    if (arrX.length < 2 || arrX.length !== arrY.length) return alert("Dữ liệu không hợp lệ. Cần ít nhất 2 điểm.");
    
    appState.dataByColumn = { 'Dữ liệu X (Nhập tay)': arrX, 'Dữ liệu Y (Nhập tay)': arrY };
    appState.columns = ['Dữ liệu X (Nhập tay)', 'Dữ liệu Y (Nhập tay)'];
    fillColumnSelect(getEl("xColumn"), appState.columns, 0); fillColumnSelect(getEl("yColumn"), appState.columns, 1);
    if(getEl("configCard")) getEl("configCard").classList.remove("disabled");
    trainRealtime();
}

function clearManualData() {
    appState.dataByColumn = {}; appState.columns = [];
    appState.mlModel = { coefficients: [], intercept: 0, modelType: 'linear', degree: 1 };
    
    if(getEl('manualX')) getEl('manualX').value = ""; if(getEl('manualY')) getEl('manualY').value = "";
    if(getEl('predictX')) getEl('predictX').value = "";
    if(getEl('mseValue')) getEl('mseValue').textContent = "--"; if(getEl('r2Value')) getEl('r2Value').textContent = "--";
    if(getEl('mathEquation')) getEl('mathEquation').innerHTML = "Phương trình hồi quy: <i>y</i> = ...";
    if(getEl('predictValue')) getEl('predictValue').style.display = 'none';
    if(getEl('configCard')) getEl('configCard').classList.add('disabled');
    
    updateStatus("Đã xóa dữ liệu điểm. Hãy nhập số mới hoặc click tạo điểm.", "#127369");
    if (appState.chart) { appState.chart.data.datasets.forEach(ds => ds.data = []); resetChartCamera(); }
}

function requestClearAll() {
    if (confirm("⚠️ Bạn có chắc chắn muốn xóa toàn bộ dữ liệu và đồ thị không?")) {
        clearManualData(); updateStatus("Đã xóa toàn bộ đồ thị và dữ liệu.", "#d96f32");
    }
}

function predictY() {
    const predictInput = getEl('predictX');
    if(!predictInput) return;
    const xVal = parseFloat(predictInput.value);
    if (isNaN(xVal)) return alert("Vui lòng nhập giá trị X hợp lệ.");
    const model = appState.mlModel;
    if (!model || model.coefficients.length === 0) return alert("Chưa có mô hình.");

    let yVal = model.intercept;
    if (model.modelType === 'linear') yVal += model.coefficients[0] * xVal;
    else model.coefficients.forEach((coef, i) => { yVal += coef * Math.pow(xVal, i + 1); });

    const resEl = getEl('predictValue');
    if(resEl) { resEl.style.display = 'block'; resEl.textContent = `Kết quả: Tại X = ${xVal}, dự đoán Y = ${yVal.toFixed(4)}`; }
    if (appState.chart && appState.chart.data.datasets[2]) {
        appState.chart.data.datasets[2].data = [{ x: xVal, y: yVal }]; appState.chart.update('none');
    }
}

function switchMode(mode) {
    appState.currentMode = mode;
    const mlSec = getEl('mlSection'); const mathSec = getEl('mathSection');
    const tabML = getEl('tabML'); const tabMath = getEl('tabMath');
    if(!mlSec || !mathSec || !tabML || !tabMath) return;

    if (mode === 'ml') {
        mlSec.style.display = 'block'; mathSec.style.display = 'none';
        tabML.className = 'tab-btn tab-active'; tabMath.className = 'tab-btn tab-inactive';
        appState.chart.options.scales.x.title = { display: false, text: "" };
        appState.chart.options.scales.y.title = { display: false, text: "" };
        if (appState.columns.length > 0) trainRealtime(); else resetChartCamera();
    } else {
        mlSec.style.display = 'none'; mathSec.style.display = 'block';
        tabMath.className = 'tab-btn tab-active'; tabML.className = 'tab-btn tab-inactive';
        plotMathRealtime();
    }
}

function updateStatus(text, color) { const st = getEl("statusText"); if(st) { st.textContent = text; st.style.color = color; } }

function formatEquationHTML(intercept, coeffs, modelType) {
    let eq = `<i>y</i> = ${intercept.toFixed(4)}`; 
    if (!coeffs || coeffs.length === 0) return eq;
    if (modelType === 'linear') {
        const sign = coeffs[0] >= 0 ? '+' : '-'; eq += ` ${sign} ${Math.abs(coeffs[0]).toFixed(4)}<i>x</i>`;
    } else {
        coeffs.forEach((coef, i) => {
            const power = i + 1; const sign = coef >= 0 ? '+' : '-'; const absCoef = Math.abs(coef).toFixed(4);
            eq += power === 1 ? ` ${sign} ${absCoef}<i>x</i>` : ` ${sign} ${absCoef}<i>x</i><sup>${power}</sup>`; 
        });
    }
    return eq;
}

function fillColumnSelect(el, columns, defaultIdx) {
    if(!el) return; el.innerHTML = "";
    columns.forEach(col => { const opt = document.createElement("option"); opt.value = col; opt.textContent = col; el.appendChild(opt); });
    el.value = columns[Math.min(defaultIdx, columns.length - 1)];
}

function syncDegreeVisibility() {
    const mt = getEl("modelType"); const dg = getEl("degreeGroup");
    if(mt && dg) { if(mt.value === "polynomial") dg.classList.remove("hidden"); else dg.classList.add("hidden"); }
}

// KHỞI ĐỘNG ỨNG DỤNG (Gọi cuối cùng)
bootstrap();