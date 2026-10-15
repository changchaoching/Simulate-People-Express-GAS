/**
 * People Express Web Simulator UI & Application Controller
 * 40-Quarter Edition + Google Sheets Two-Sheet Architecture Webhook
 */

let engine = new PeopleExpressEngine();
let charts = {};

// LocalStorage 鍵名
const STORAGE_KEY_WEBHOOK = "people_express_webhook_url";
const STORAGE_KEY_CLASS = "people_express_class_name";
const STORAGE_KEY_ID = "people_express_student_id";
const STORAGE_KEY_NAME = "people_express_student_name";

document.addEventListener("DOMContentLoaded", () => {
    if (window.lucide) lucide.createIcons();
    initCharts();
    bindInputs();
    loadStoredCredentials();
    updateUI();
});

// 1. 初始化 4 個 Chart.js 圖表
function initCharts() {
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: '#334155', font: { size: 10, family: 'Inter' } }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: '#cbd5e1',
                borderWidth: 1,
                titleColor: '#0f172a',
                bodyColor: '#334155',
                titleFont: { size: 11, family: 'JetBrains Mono' },
                bodyFont: { size: 10, family: 'JetBrains Mono' }
            }
        },
        scales: {
            x: {
                grid: { color: 'rgba(226, 232, 240, 0.8)' },
                ticks: { color: '#475569', font: { size: 9, family: 'JetBrains Mono' } }
            },
            y: {
                grid: { color: 'rgba(226, 232, 240, 0.8)' },
                ticks: { color: '#475569', font: { size: 9, family: 'JetBrains Mono' } }
            }
        }
    };

    // (A) 機隊 vs 員工 (雙Y軸)
    const ctxScale = document.getElementById('chartScale').getContext('2d');
    charts.scale = new Chart(ctxScale, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '飛機架數 (架)',
                    data: [],
                    borderColor: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    yAxisID: 'y',
                    borderWidth: 2,
                    tension: 0.2
                },
                {
                    label: '員工總數 (人)',
                    data: [],
                    borderColor: '#9333ea',
                    backgroundColor: 'rgba(147, 51, 234, 0.1)',
                    yAxisID: 'y1',
                    borderWidth: 2,
                    borderDash: [4, 4],
                    tension: 0.2
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y1: {
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#9333ea', font: { size: 9, family: 'JetBrains Mono' } }
                }
            }
        }
    });

    // (B) 載客率 vs 損益平衡線
    const ctxLF = document.getElementById('chartLoadFactor').getContext('2d');
    charts.loadFactor = new Chart(ctxLF, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '實際載客率 (%)',
                    data: [],
                    borderColor: '#d97706',
                    backgroundColor: 'rgba(217, 119, 6, 0.1)',
                    borderWidth: 2.5,
                    tension: 0.2
                },
                {
                    label: '損益平衡線 (%)',
                    data: [],
                    borderColor: '#dc2626',
                    borderDash: [5, 5],
                    borderWidth: 1.5,
                    tension: 0.1
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    min: 20,
                    max: 100
                }
            }
        }
    });

    // (C) 財務走勢 (營收、成本、當季淨利)
    const ctxFin = document.getElementById('chartFinancials').getContext('2d');
    charts.financials = new Chart(ctxFin, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '當季營收 ($M)',
                    data: [],
                    borderColor: '#059669',
                    borderWidth: 2,
                    tension: 0.2
                },
                {
                    label: '當季總成本 ($M)',
                    data: [],
                    borderColor: '#e11d48',
                    borderWidth: 1.5,
                    borderDash: [3, 3],
                    tension: 0.2
                },
                {
                    label: '當季淨利 ($M)',
                    data: [],
                    borderColor: '#2563eb',
                    borderWidth: 2,
                    tension: 0.2
                }
            ]
        },
        options: commonOptions
    });

    // (D) 無形資產指標 (聲譽、士氣、工時倍數)
    const ctxIntangibles = document.getElementById('chartIntangibles').getContext('2d');
    charts.intangibles = new Chart(ctxIntangibles, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '服務聲譽 (Reputation)',
                    data: [],
                    borderColor: '#7c3aed',
                    borderWidth: 2,
                    tension: 0.2
                },
                {
                    label: '員工士氣 (Morale)',
                    data: [],
                    borderColor: '#10b981',
                    borderWidth: 2,
                    tension: 0.2
                },
                {
                    label: '工時倍數 (Workload)',
                    data: [],
                    borderColor: '#f97316',
                    borderWidth: 1.5,
                    borderDash: [4, 4],
                    tension: 0.2
                }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    min: 0,
                    max: 1.6
                }
            }
        }
    });
}

// 2. 綁定滑桿與數值動態連動
function bindInputs() {
    const sync = (sliderId, displayId, prefix = '', suffix = '', divisor = 1) => {
        const slider = document.getElementById(sliderId);
        const display = document.getElementById(displayId);
        if (!slider || !display) return;
        const update = () => {
            let val = Number(slider.value);
            if (divisor !== 1) val = (val / divisor).toFixed(divisor === 1000 ? 3 : 2);
            display.textContent = `${prefix}${val}${suffix}`;
            updateLivePreview();
        };
        slider.addEventListener('input', update);
        update();
    };

    sync('inputFare', 'valFare', '$', '/座哩', 1000);
    sync('inputPlanes', 'valPlanes', '', ' 架');
    sync('inputHiring', 'valHiring', '', ' 人');
    sync('inputMarketing', 'valMarketing', '', '%', 0.01);
    sync('inputScope', 'valScope', '', '', 1);

    const btnNext = document.getElementById('btnNextQuarter');
    if (btnNext) btnNext.addEventListener('click', () => runSimulation(1));

    const btnNextYear = document.getElementById('btnNextYear');
    if (btnNextYear) btnNextYear.addEventListener('click', () => runSimulation(4));
}

// 實時預估當季支出與營運
function updateLivePreview() {
    const fare = Number(document.getElementById('inputFare').value);
    const planeOrder = Number(document.getElementById('inputPlanes').value);
    const hire = Number(document.getElementById('inputHiring').value);
    
    const previewEl = document.getElementById('previewNotice');
    if (previewEl) {
        let text = `預估：新購機自籌首期款 $${(planeOrder > 0 ? planeOrder * 2.0 : 0).toFixed(1)}M，培訓新人 ${hire} 人`;
        previewEl.textContent = text;
    }
}

// 3. 推進季度 (Advance Quarters)
function runSimulation(steps = 1) {
    if (engine.isGameOver) {
        openSubmitModal();
        return;
    }

    for (let i = 0; i < steps; i++) {
        if (engine.isGameOver) break;

        const decisions = {
            peoplesFare: Number(document.getElementById('inputFare').value),
            aircraftPurchases: Number(document.getElementById('inputPlanes').value),
            hiring: Number(document.getElementById('inputHiring').value),
            marketingFraction: Number(document.getElementById('inputMarketing').value),
            targetServiceScope: Number(document.getElementById('inputScope').value)
        };

        engine.step(decisions);
    }

    updateUI();

    if (engine.isGameOver) {
        setTimeout(() => {
            openSubmitModal();
        }, 800);
    }
}

// 4. 更新整體 UI 介面
function updateUI() {
    // (A) 頂部狀態列
    let currentY = 1981 + Math.floor((engine.currentQuarter - 1) / 4);
    let currentQ = ((engine.currentQuarter - 1) % 4) + 1;
    let quarterLabel = `Y${currentY} Q${currentQ}`;

    setText('kpiQuarter', quarterLabel);
    setText('kpiQuarterNum', Math.min(40, engine.currentQuarter));
    setText('kpiCash', `$${engine.cash.toFixed(1)}M`);
    setText('kpiCumulativeProfit', `$${engine.cumulativeNetIncome.toFixed(1)}M`);

    // (B) 核心 KPI 指標卡
    setText('kpiPlanes', engine.planes);
    setText('kpiPipelinePlanes', engine.planeOrdersInPipeline.reduce((a, b) => a + b, 0));
    setText('kpiTotalStaff', engine.experiencedStaff + engine.rookieStaff);
    setText('kpiRookies', engine.rookieStaff);
    setText('kpiWorkHours', `${engine.currentWorkHours.toFixed(1)}h`);
    setText('kpiMorale', engine.staffMorale.toFixed(2));
    setText('kpiReputation', engine.serviceReputation.toFixed(2));
    setText('kpiQuality', engine.actualServiceQuality.toFixed(2));
    setText('kpiLoadFactor', `${(engine.loadFactor * 100).toFixed(1)}%`);
    setText('kpiBreakevenLF', `${(engine.breakevenLoadFactor * 100).toFixed(1)}%`);
    setText('kpiStockPrice', `$${engine.stockPrice.toFixed(2)}`);
    setText('kpiDebt', `$${engine.debt.toFixed(1)}M`);

    // (C) 警示橫幅與按鈕狀態
    const banner = document.getElementById('gameAlertBanner');
    const alertTitle = document.getElementById('alertTitle');
    const alertMsg = document.getElementById('alertMessage');
    const btnNext = document.getElementById('btnNextQuarter');

    if (engine.isGameOver) {
        banner.classList.remove('hidden');
        if (engine.cash < -20.0) {
            banner.className = "p-4 rounded-2xl border transition-all shadow-md bg-rose-50 border-rose-200 text-rose-900";
            alertTitle.textContent = "人民航空宣告破產 (Insolvency)";
            alertMsg.textContent = engine.gameOverReason;
        } else {
            banner.className = "p-4 rounded-2xl border transition-all shadow-md bg-emerald-50 border-emerald-200 text-emerald-900";
            alertTitle.textContent = "完成 10 年 (40 季) 經營里程碑！";
            alertMsg.textContent = engine.gameOverReason;
        }

        if (btnNext) {
            btnNext.innerHTML = `<i data-lucide="award" class="w-4 h-4"></i> 經營已結算・登錄總成績至 Google 試算表`;
            btnNext.className = "w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition cursor-pointer";
        }
    } else {
        banner.classList.add('hidden');
        if (btnNext) {
            btnNext.innerHTML = `<i data-lucide="play" class="w-4 h-4 fill-white"></i> 推進下一季 (Run Next Quarter)`;
            btnNext.className = "w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition cursor-pointer";
        }
    }

    // 更新圖表與資料表
    updateCharts();
    updateTableData();

    if (window.lucide) lucide.createIcons();
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// 更新圖表
function updateCharts() {
    const labels = engine.history.map(h => h.label);

    // Scale chart
    charts.scale.data.labels = labels;
    charts.scale.data.datasets[0].data = engine.history.map(h => h.planes);
    charts.scale.data.datasets[1].data = engine.history.map(h => h.totalStaff);
    charts.scale.update('none');

    // Load Factor chart
    charts.loadFactor.data.labels = labels;
    charts.loadFactor.data.datasets[0].data = engine.history.map(h => h.loadFactor);
    charts.loadFactor.data.datasets[1].data = engine.history.map(h => h.breakevenLoadFactor);
    charts.loadFactor.update('none');

    // Financials chart
    charts.financials.data.labels = labels;
    charts.financials.data.datasets[0].data = engine.history.map(h => h.revenue);
    charts.financials.data.datasets[1].data = engine.history.map(h => h.totalExpenses);
    charts.financials.data.datasets[2].data = engine.history.map(h => h.netIncome);
    charts.financials.update('none');

    // Intangibles chart
    charts.intangibles.data.labels = labels;
    charts.intangibles.data.datasets[0].data = engine.history.map(h => h.serviceReputation);
    charts.intangibles.data.datasets[1].data = engine.history.map(h => h.morale);
    charts.intangibles.data.datasets[2].data = engine.history.map(h => Math.round((h.workHours / 40) * 100) / 100);
    charts.intangibles.update('none');
}

// 更新資料歷程表格
function updateTableData() {
    const tbody = document.getElementById('dataTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    [...engine.history].reverse().forEach(h => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition border-b border-slate-200';
        const netClass = h.netIncome >= 0 ? 'text-emerald-600' : 'text-rose-600';
        tr.innerHTML = `
            <td class="p-2 font-bold text-slate-800">${h.label}</td>
            <td class="p-2 text-right">${h.planes}</td>
            <td class="p-2 text-right">${h.totalStaff}</td>
            <td class="p-2 text-right">${h.workHours}h</td>
            <td class="p-2 text-right">${h.morale}</td>
            <td class="p-2 text-right">${h.serviceReputation}</td>
            <td class="p-2 text-right">${h.loadFactor}%</td>
            <td class="p-2 text-right text-slate-400">${h.breakevenLoadFactor}%</td>
            <td class="p-2 text-right">$${h.peoplesFare.toFixed(3)}</td>
            <td class="p-2 text-right">$${h.revenue.toFixed(1)}M</td>
            <td class="p-2 text-right text-slate-500">$${h.totalExpenses.toFixed(1)}M</td>
            <td class="p-2 text-right font-bold ${netClass}">${h.netIncome >= 0 ? '+' : ''}$${h.netIncome.toFixed(2)}M</td>
            <td class="p-2 text-right">$${h.cash.toFixed(1)}M</td>
        `;
        tbody.appendChild(tr);
    });
}

// 5. 頁籤切換
function switchView(viewName) {
    document.getElementById('viewCharts').classList.toggle('hidden', viewName !== 'charts');
    document.getElementById('viewTable').classList.toggle('hidden', viewName !== 'table');
    document.getElementById('viewCausal').classList.toggle('hidden', viewName !== 'causal');

    const btnCharts = document.getElementById('tabBtnCharts');
    const btnTable = document.getElementById('tabBtnTable');
    const btnCausal = document.getElementById('tabBtnCausal');

    [btnCharts, btnTable, btnCausal].forEach(btn => {
        btn.className = 'px-3.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-600 text-xs font-semibold transition';
    });

    if (viewName === 'charts') {
        btnCharts.className = 'px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold transition';
    } else if (viewName === 'table') {
        btnTable.className = 'px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold transition';
    } else if (viewName === 'causal') {
        btnCausal.className = 'px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold transition';
    }
}

// 6. 套用經典策略預設情境
function applyPreset(type) {
    if (type === 'burr') {
        // Donald Burr 激進狂暴擴張模式
        document.getElementById('inputFare').value = 0.085;
        document.getElementById('inputPlanes').value = 4;
        document.getElementById('inputHiring').value = 40;
        document.getElementById('inputMarketing').value = 0.10;
        document.getElementById('inputScope').value = 0.40;
    } else if (type === 'balanced') {
        // 穩健均衡擴張模式
        document.getElementById('inputFare').value = 0.105;
        document.getElementById('inputPlanes').value = 1;
        document.getElementById('inputHiring').value = 35;
        document.getElementById('inputMarketing').value = 0.06;
        document.getElementById('inputScope').value = 0.25;
    } else if (type === 'conservative') {
        // 謹慎保守防守模式
        document.getElementById('inputFare').value = 0.120;
        document.getElementById('inputPlanes').value = 0;
        document.getElementById('inputHiring').value = 10;
        document.getElementById('inputMarketing').value = 0.05;
        document.getElementById('inputScope').value = 0.20;
    }

    ['inputFare', 'inputPlanes', 'inputHiring', 'inputMarketing', 'inputScope'].forEach(id => {
        document.getElementById(id).dispatchEvent(new Event('input'));
    });
}

// 7. 重置模擬
function resetGame() {
    if (confirm('確定要重新開始模擬嗎？當前歷程將會清空。')) {
        engine = new PeopleExpressEngine();
        document.getElementById('inputFare').value = 0.090;
        document.getElementById('inputPlanes').value = 1;
        document.getElementById('inputHiring').value = 35;
        document.getElementById('inputMarketing').value = 0.08;
        document.getElementById('inputScope').value = 0.30;
        ['inputFare', 'inputPlanes', 'inputHiring', 'inputMarketing', 'inputScope'].forEach(id => {
            document.getElementById(id).dispatchEvent(new Event('input'));
        });
        updateUI();
    }
}

// 8. 匯出 CSV 報表
function exportCSV() {
    let csv = "Quarter,Period,Year,Q,Planes,Staff,WorkHours,Morale,Reputation,ServiceQuality,ASM_M,RPM_M,LoadFactor_pct,BreakevenLF_pct,Fare,Revenue_M,Expenses_M,NetIncome_M,CumulativeNetIncome_M,Cash_M,Debt_M,StockPrice\n";
    engine.history.forEach(h => {
        csv += `${h.quarter},${h.label},${h.year},${h.q},${h.planes},${h.totalStaff},${h.workHours},${h.morale},${h.serviceReputation},${h.serviceQuality},${h.asm},${h.rpm},${h.loadFactor},${h.breakevenLoadFactor},${h.peoplesFare},${h.revenue},${h.totalExpenses},${h.netIncome},${h.cumulativeNetIncome},${h.cash},${h.debt},${h.stockPrice}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `People_Express_Simulation_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// 9. Google 試算表串接 (雙工作表架構)
// ==========================================

function loadStoredCredentials() {
    const savedUrl = localStorage.getItem(STORAGE_KEY_WEBHOOK) || "";
    const savedClass = localStorage.getItem(STORAGE_KEY_CLASS) || "";
    const savedId = localStorage.getItem(STORAGE_KEY_ID) || "";
    const savedName = localStorage.getItem(STORAGE_KEY_NAME) || "";

    const elUrl = document.getElementById('inputWebhookUrl');
    const elClass = document.getElementById('inputClass');
    const elId = document.getElementById('inputId');
    const elName = document.getElementById('inputName');

    if (elUrl) elUrl.value = savedUrl;
    if (elClass) elClass.value = savedClass;
    if (elId) elId.value = savedId;
    if (elName) elName.value = savedName;

    const btnOpen = document.getElementById('btnOpenSubmitModal');
    if (btnOpen) btnOpen.addEventListener('click', openSubmitModal);

    const btnSubmit = document.getElementById('btnSubmitScore');
    if (btnSubmit) btnSubmit.addEventListener('click', submitToGoogleSheets);
}

function openSubmitModal() {
    const modal = document.getElementById('submitModal');
    if (!modal) return;

    let currentY = 1981 + Math.floor((engine.currentQuarter - 1) / 4);
    let currentQ = ((engine.currentQuarter - 1) % 4) + 1;

    setText('modalSummaryQuarter', `第 ${Math.min(40, engine.currentQuarter)} 季 (Y${currentY} Q${currentQ}) - ${engine.isGameOver ? '營運已結算' : '進行中'}`);
    setText('modalSummaryProfit', `$${engine.cumulativeNetIncome.toFixed(1)}M (當季淨利: $${engine.netIncome.toFixed(2)}M)`);
    setText('modalSummaryScale', `${engine.planes} 架客機 / ${engine.experiencedStaff + engine.rookieStaff} 位員工`);
    setText('modalSummaryReputation', `${engine.serviceReputation.toFixed(2)} (載客率: ${(engine.loadFactor * 100).toFixed(1)}%)`);

    const msgEl = document.getElementById('submitResultMsg');
    if (msgEl) msgEl.innerHTML = '';

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeSubmitModal() {
    const modal = document.getElementById('submitModal');
    if (modal) modal.classList.add('hidden');
}

function toggleWebhookConfig() {
    const el = document.getElementById('inputWebhookUrl');
    if (el) {
        el.focus();
        el.select();
    }
}

function submitToGoogleSheets() {
    const elUrl = document.getElementById('inputWebhookUrl');
    const elClass = document.getElementById('inputClass');
    const elId = document.getElementById('inputId');
    const elName = document.getElementById('inputName');
    const msgEl = document.getElementById('submitResultMsg');

    const webhookUrl = elUrl ? elUrl.value.trim() : "";
    const className = elClass ? elClass.value.trim() : "";
    const studentId = elId ? elId.value.trim() : "";
    const studentName = elName ? elName.value.trim() : "";

    if (!studentId || !studentName) {
        alert("請填寫「學號」與「姓名」！");
        return;
    }

    if (!webhookUrl) {
        alert("尚未填寫 Google Apps Script Webhook 網址！\n請先依據指引在 Google 試算表部署 Web 應用程式並貼上網址。");
        if (elUrl) elUrl.focus();
        return;
    }

    // 儲存於 LocalStorage
    localStorage.setItem(STORAGE_KEY_WEBHOOK, webhookUrl);
    localStorage.setItem(STORAGE_KEY_CLASS, className);
    localStorage.setItem(STORAGE_KEY_ID, studentId);
    localStorage.setItem(STORAGE_KEY_NAME, studentName);

    // 計算平均載客率
    const avgLoadFactor = engine.history.length > 0
        ? Number((engine.history.reduce((sum, h) => sum + h.loadFactor, 0) / engine.history.length).toFixed(1))
        : Number((engine.loadFactor * 100).toFixed(1));

    // 打包工作表 2 所需之 40 季歷程
    const quarterlyLogs = engine.history.map(r => ({
        quarter: r.quarter,
        label: r.label,
        year: r.year,
        q: r.q,
        planes: r.planes,
        totalStaff: r.totalStaff,
        experiencedStaff: r.experiencedStaff,
        rookieStaff: r.rookieStaff,
        workHours: r.workHours,
        morale: r.morale,
        serviceReputation: r.serviceReputation,
        serviceQuality: r.serviceQuality,
        asm: r.asm,
        rpm: r.rpm,
        loadFactor: r.loadFactor,
        breakevenLoadFactor: r.breakevenLoadFactor,
        peoplesFare: r.peoplesFare,
        revenue: r.revenue,
        fuelAndMaintCost: r.fuelAndMaintCost,
        laborCost: r.laborCost,
        marketingCost: r.marketingCost,
        totalExpenses: r.totalExpenses,
        netIncome: r.netIncome,
        cumulativeNetIncome: r.cumulativeNetIncome,
        cash: r.cash,
        debt: r.debt,
        stockPrice: r.stockPrice
    }));

    const payload = {
        summary: {
            className: className,
            studentId: studentId,
            studentName: studentName,
            cumulativeNetIncomeM: Number(engine.cumulativeNetIncome.toFixed(1)),
            finalPlanes: engine.planes,
            finalStaff: engine.experiencedStaff + engine.rookieStaff,
            finalReputation: Number(engine.serviceReputation.toFixed(2)),
            avgLoadFactor: avgLoadFactor,
            finalStockPrice: Number(engine.stockPrice.toFixed(2)),
            cashM: Number(engine.cash.toFixed(1)),
            isBankrupt: engine.cash < -20.0,
            isWon: engine.currentQuarter >= engine.maxQuarters && engine.cash >= 0,
            gameOverReason: engine.gameOverReason || "模擬進行中提交",
            totalLoggedQuarters: quarterlyLogs.length
        },
        yearlyLogs: quarterlyLogs,
        quarterlyLogs: quarterlyLogs
    };

    if (msgEl) {
        msgEl.innerHTML = '<span class="text-blue-600 font-semibold flex items-center justify-center gap-1"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 正在批次傳輸經營成果與 40 季明細至 Google 試算表...</span>';
        if (window.lucide) lucide.createIcons();
    }

    const btnSubmit = document.getElementById('btnSubmitScore');
    if (btnSubmit) btnSubmit.disabled = true;

    fetch(webhookUrl, {
        method: "POST",
        mode: "no-cors", // 跨網域回傳，防止 CORS 阻擋
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(() => {
        if (msgEl) {
            msgEl.innerHTML = '<span class="text-emerald-700 font-bold flex items-center justify-center gap-1.5 bg-emerald-50 py-2 rounded-lg border border-emerald-200">✅ 成績與 40 季營運明細已成功登錄至 Google 試算表雙工作表！</span>';
        }
        if (btnSubmit) btnSubmit.disabled = false;
        setTimeout(() => {
            closeSubmitModal();
        }, 2200);
    })
    .catch(err => {
        console.error("Submission failed:", err);
        if (msgEl) {
            msgEl.innerHTML = '<span class="text-rose-600 font-semibold">❌ 連線失敗，請檢查 Apps Script Webhook 網址是否正確部署為「所有人」皆可存取。</span>';
        }
        if (btnSubmit) btnSubmit.disabled = false;
    });
}
