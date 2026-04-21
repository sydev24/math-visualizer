const getEl = (id) => document.getElementById(id);

const appState = {
    currentMode: 'ml',
    isClickMode: false,
    chart: null,
    columns: [],
    dataByColumn: {},
    trainAbortController: null,
    mlModel: { coefficients: [], intercept: 0, modelType: 'linear', degree: 1 }
};