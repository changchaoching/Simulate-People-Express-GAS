/**
 * People Express Management Flight Simulator Core Engine (40 Quarters Edition)
 * Based on John Sterman (MIT Sloan, 1988) & John Morecroft System Dynamics Formulations
 */

class PeopleExpressEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.currentQuarter = 1;
        this.maxQuarters = 40; // 10 Years (Q1 1981 - Q4 1990)
        this.isGameOver = false;
        this.gameOverReason = "";

        // ---- 1. 機隊與運能 (Fleet & Capacity) ----
        this.planes = 10;                     // 初始飛機數量 (10架 Boeing 737)
        this.planeOrdersInPipeline = [0, 0];  // 飛機交付訂單管道 (延遲 2 季)
        this.seatsPerPlane = 120;             // 平均座位數
        this.hoursPerPlanePerQuarter = 900;   // 每季飛行時數
        this.averageSpeed = 450;              // 平均時速 (mph)
        // 1 架飛機每季產出之座哩 ASM = 120 * 900 * 450 / 1e6 = 48.6 百萬座哩 (M ASM)
        this.asmPerPlane = (this.seatsPerPlane * this.hoursPerPlanePerQuarter * this.averageSpeed) / 1e6;

        // ---- 2. 人力資源與服務能力 (Staff & Service Capacity) ----
        // 初始員工：300 人管理 10 架飛機 (約 30 人/架，符合精簡廉航編制)
        this.experiencedStaff = 260;          // 資深全能正職員工 (Customer Service Managers)
        this.rookieStaff = 40;                // 新進受訓員工 (培訓期 1 季)
        this.targetWorkHours = 40;            // 標準每週工時
        this.currentWorkHours = 40;           // 實際工時
        this.staffMorale = 1.0;               // 員工士氣 (1.0為滿分基準)
        this.turnoverRate = 0.04;             // 季自然離職率 4%
        // 每位資深員工每季可良好支援服務的座哩數 (約 1.8 M ASM / 人，即 270 人可支援 10 架飛機 486 M ASM)
        this.staffProductivityNorm = 1.80;    

        // ---- 3. 市場競爭、聲譽與需求 (Market, Reputation, Demand) ----
        this.peoplesFare = 0.090;             // 人民航空平均票價 ($/seat-mile, 9 cents)
        this.competitorFare = 0.160;          // 競爭者平均票價 (16 cents)
        this.competitorStrength = 1.0;        // 競爭者反制強度
        this.serviceReputation = 1.0;         // 服務聲譽 (1.0為良好)
        this.targetServiceScope = 0.30;       // 目標服務範疇 (0=極簡, 1=全套)
        this.actualServiceQuality = 1.0;      // 實際交付服務品質
        this.marketingFraction = 0.08;        // 行銷預算佔營收比重 (8%)
        
        // 總市場基礎需求 (M Passenger Miles, RPM)
        this.baseMarketDemand = 360;          // 初始潛在需求
        this.marketGrowthRate = 0.015;        // 航空市場自然季度增長率

        // 運營產出
        this.asm = this.planes * this.asmPerPlane; // 486 M ASM
        this.rpm = 330;                            // 330 M RPM
        this.loadFactor = 0.679;                   // 載客率 ~68%
        this.breakevenLoadFactor = 0.55;           // 損益平衡載客率 ~55%

        // ---- 4. 財務指標 (Financials, 單位: 百萬美元 $M) ----
        this.cash = 15.0;                     // 現金儲備
        this.debt = 25.0;                     // 長期借貸
        this.stockPrice = 12.0;               // 每股市價 ($12)
        
        // 當季收支初始化
        this.revenue = this.rpm * this.peoplesFare; // ~ $29.7M
        this.fuelAndMaintCost = this.asm * 0.032;  // ~ $15.5M
        this.laborCost = ((this.experiencedStaff + this.rookieStaff) * 6500) / 1e6; // ~ $1.95M
        this.marketingCost = this.revenue * this.marketingFraction; // ~ $2.38M
        this.planeLeaseAndDepr = this.planes * 0.35; // ~ $3.5M
        this.interestExpense = this.debt * 0.020;    // ~ $0.5M
        this.otherOpCost = 2.0 + this.planes * 0.12; // ~ $3.2M
        this.totalExpenses = this.fuelAndMaintCost + this.laborCost + this.marketingCost + 
                             this.planeLeaseAndDepr + this.interestExpense + this.otherOpCost;
        this.netIncome = this.revenue - this.totalExpenses; // ~ +$2.6M
        this.cumulativeNetIncome = this.netIncome;

        // ---- 5. 歷史記錄 ----
        this.history = [];
        this.recordHistory();
    }

    /**
     * 執行推進一季 (Step Simulation by 1 Quarter)
     * @param {Object} decisions 玩家決策
     */
    step(decisions) {
        if (this.isGameOver) return;

        // 1. 取得與校驗決策
        this.peoplesFare = Math.max(0.04, Math.min(0.25, Number(decisions.peoplesFare) || 0.09));
        let planeOrder = Math.max(-5, Math.min(15, Number(decisions.aircraftPurchases) || 0));
        let hiringOrder = Math.max(-100, Math.min(300, Number(decisions.hiring) || 0));
        this.marketingFraction = Math.max(0.0, Math.min(0.25, Number(decisions.marketingFraction) || 0.08));
        this.targetServiceScope = Math.max(0.0, Math.min(1.0, Number(decisions.targetServiceScope) || 0.3));

        // 2. 機隊更新 (採購 2 季延遲，處分立即)
        let deliveredPlanes = this.planeOrdersInPipeline.shift() || 0;
        this.planeOrdersInPipeline.push(planeOrder > 0 ? planeOrder : 0);
        
        if (planeOrder < 0) {
            this.planes = Math.max(2, this.planes + planeOrder);
        }
        this.planes = Math.max(2, this.planes + deliveredPlanes);
        this.asm = this.planes * this.asmPerPlane;

        // 3. 人事與服務產能 (Rookies 培訓 1 季)
        let newlyTrainedStaff = this.rookieStaff;
        this.rookieStaff = Math.max(0, hiringOrder > 0 ? hiringOrder : 0);
        
        let totalStaffBeforeTurnover = this.experiencedStaff + newlyTrainedStaff;
        if (hiringOrder < 0) {
            totalStaffBeforeTurnover = Math.max(30, totalStaffBeforeTurnover + hiringOrder);
        }
        
        // 自然離職率 (士氣低落時離職率自 4% 飆升至 12%)
        let actualTurnoverRate = this.turnoverRate * (1.6 - 0.6 * Math.min(1.4, Math.max(0.2, this.staffMorale)));
        let departures = Math.round(totalStaffBeforeTurnover * actualTurnoverRate);
        this.experiencedStaff = Math.max(30, totalStaffBeforeTurnover - departures);

        // 總有效服務能力 (資深員工 100%, 新人受訓提供 35% 支援)
        let effectiveStaffCapacity = (this.experiencedStaff * 1.0 + this.rookieStaff * 0.35) * this.staffProductivityNorm;
        
        // 所需服務能力 (與 ASM 及 目標服務範疇 連動)
        let requiredStaffCapacity = this.asm * (0.85 + 0.5 * this.targetServiceScope);
        let workloadRatio = requiredStaffCapacity / Math.max(1.0, effectiveStaffCapacity);

        // 每週工時 (基準40小時，過載時員工狂加班，上限 62 小時)
        this.currentWorkHours = Math.min(62, Math.max(35, 40 * workloadRatio));

        // 服務品質 (Quality): 當工時超過 45 小時或新手比過高時迅速劣化
        let rookieRatio = this.rookieStaff / Math.max(1, (this.experiencedStaff + this.rookieStaff));
        let qualityWorkloadFactor = workloadRatio <= 1.05 
            ? Math.min(1.2, 1.0 + (1.0 - workloadRatio) * 0.4) 
            : Math.max(0.2, 1.0 - (workloadRatio - 1.05) * 1.5);
        let qualityRookiePenalty = Math.max(0.6, 1.0 - rookieRatio * 0.7);
        this.actualServiceQuality = Math.max(0.1, Math.min(1.3, qualityWorkloadFactor * qualityRookiePenalty));

        // 員工士氣 (Morale): 受工時負面打擊與股價激勵
        let stockIncentive = Math.min(1.3, Math.max(0.7, this.stockPrice / 12.0));
        let targetMorale = (workloadRatio <= 1.1 ? 1.05 : Math.max(0.25, 1.05 - (workloadRatio - 1.1) * 1.4)) * stockIncentive;
        this.staffMorale = this.staffMorale * 0.6 + targetMorale * 0.4;

        // 服務聲譽 (Service Reputation): 顧客口碑平滑滯後反映實際品質
        this.serviceReputation = this.serviceReputation * 0.75 + this.actualServiceQuality * 0.25;

        // 4. 市場需求與競爭反制
        this.baseMarketDemand *= (1 + this.marketGrowthRate);

        // 傳統對手動態反制 (當 People Express 機隊規模 > 24 架時啟動反制)
        if (this.planes > 24) {
            this.competitorStrength = Math.min(1.5, this.competitorStrength + 0.05);
            this.competitorFare = Math.max(0.12, this.competitorFare - 0.003); // 巨頭降價反擊
        } else if (this.planes < 18) {
            this.competitorStrength = Math.max(0.9, this.competitorStrength - 0.02);
        }

        // 價格吸引力 (價格彈性約 -1.5)
        let priceRatio = this.competitorFare / Math.max(0.04, this.peoplesFare);
        let priceAttractiveness = Math.pow(priceRatio, 1.5);

        // 行銷吸引力
        let marketingAttractiveness = 0.8 + 2.2 * Math.sqrt(this.marketingFraction);

        // 服務聲譽吸引力 (口碑一旦跌破 0.6，客源斷崖式流失)
        let reputationAttractiveness = Math.pow(this.serviceReputation, 1.6);

        // 航網擴張效益 (非線性飽和)
        let networkCoverageFactor = Math.min(3.2, Math.pow(this.planes / 10.0, 0.8));

        // 潛在未受限顧客需求 (RPM)
        let potentialDemand = (this.baseMarketDemand * 0.85) * 
                              priceAttractiveness * 
                              marketingAttractiveness * 
                              reputationAttractiveness * 
                              networkCoverageFactor / 
                              this.competitorStrength;

        // 實質計費座哩 (受機隊運能實體限制，最高 92% 滿座)
        this.rpm = Math.min(this.asm * 0.92, potentialDemand);
        this.loadFactor = this.rpm / Math.max(0.1, this.asm);

        // 5. 財務核算
        this.revenue = this.rpm * this.peoplesFare;
        this.fuelAndMaintCost = this.asm * 0.032;
        
        let avgSalaryPerStaff = 6500;
        let overtimeMultiplier = this.currentWorkHours > 40 ? (1 + (this.currentWorkHours - 40) / 40 * 1.5) : 1.0;
        this.laborCost = ((this.experiencedStaff + this.rookieStaff) * avgSalaryPerStaff * overtimeMultiplier) / 1e6;

        this.marketingCost = this.revenue * this.marketingFraction;
        this.planeLeaseAndDepr = this.planes * 0.35;
        this.interestExpense = this.debt * 0.020;
        this.otherOpCost = 2.0 + this.planes * 0.12;

        this.totalExpenses = this.fuelAndMaintCost + this.laborCost + this.marketingCost + 
                             this.planeLeaseAndDepr + this.interestExpense + this.otherOpCost;

        this.netIncome = this.revenue - this.totalExpenses;
        this.cumulativeNetIncome += this.netIncome;

        this.breakevenLoadFactor = this.totalExpenses / (this.asm * this.peoplesFare);

        // 現金流更新 (每購 1 架飛機自付首期款約 $2.0M，其餘 $5.0M 銀行融資)
        let capitalExpenditure = (planeOrder > 0 ? planeOrder * 2.0 : 0);
        if (planeOrder < 0) {
            this.cash += Math.abs(planeOrder) * 1.5; // 出售二手飛機回收部分現金
            this.debt = Math.max(0, this.debt - Math.abs(planeOrder) * 3.0);
        }
        if (planeOrder > 0) {
            this.debt += planeOrder * 5.0;
        }
        this.cash += (this.netIncome - capitalExpenditure);

        // 股價連動
        let targetStockPrice = Math.max(1.0, 12.0 + (this.netIncome * 1.8) + (this.serviceReputation - 1.0) * 8.0);
        this.stockPrice = Math.max(1.0, this.stockPrice * 0.7 + targetStockPrice * 0.3);

        // 6. 破產判定 (現金小於 -$20M)
        if (this.cash < -20.0) {
            this.isGameOver = true;
            this.gameOverReason = `【宣告破產 (Bankruptcy)】第 ${this.currentQuarter} 季現金流耗盡 (累積虧損致現金流降至 $${this.cash.toFixed(1)}M)。People Express 無力償付債務，被德州航空強制收購！`;
        } else if (this.currentQuarter >= this.maxQuarters) {
            this.isGameOver = true;
            this.gameOverReason = `【完成 10 年經營週期】成功達成 40 季營運！累計淨利: $${this.cumulativeNetIncome.toFixed(1)}M，最終機隊規模: ${this.planes} 架，服務聲譽: ${this.serviceReputation.toFixed(2)}，每股市價: $${this.stockPrice.toFixed(2)}。`;
        }

        // 7. 推進季度並記錄
        this.currentQuarter++;
        this.recordHistory();
    }

    recordHistory() {
        let year = 1981 + Math.floor((this.currentQuarter - 1) / 4);
        let q = ((this.currentQuarter - 1) % 4) + 1;
        let periodLabel = `Y${year} Q${q}`;

        this.history.push({
            quarter: this.currentQuarter,
            label: periodLabel,
            year: year,
            q: q,
            planes: this.planes,
            experiencedStaff: this.experiencedStaff,
            rookieStaff: this.rookieStaff,
            totalStaff: this.experiencedStaff + this.rookieStaff,
            workHours: Math.round(this.currentWorkHours * 10) / 10,
            morale: Math.round(this.staffMorale * 100) / 100,
            serviceReputation: Math.round(this.serviceReputation * 100) / 100,
            serviceQuality: Math.round(this.actualServiceQuality * 100) / 100,
            asm: Math.round(this.asm * 10) / 10,
            rpm: Math.round(this.rpm * 10) / 10,
            loadFactor: Math.round(this.loadFactor * 1000) / 10,
            breakevenLoadFactor: Math.round(this.breakevenLoadFactor * 1000) / 10,
            peoplesFare: this.peoplesFare,
            revenue: Math.round(this.revenue * 100) / 100,
            fuelAndMaintCost: Math.round(this.fuelAndMaintCost * 100) / 100,
            laborCost: Math.round(this.laborCost * 100) / 100,
            marketingCost: Math.round(this.marketingCost * 100) / 100,
            totalExpenses: Math.round(this.totalExpenses * 100) / 100,
            netIncome: Math.round(this.netIncome * 100) / 100,
            cumulativeNetIncome: Math.round(this.cumulativeNetIncome * 100) / 100,
            cash: Math.round(this.cash * 100) / 100,
            debt: Math.round(this.debt * 100) / 100,
            stockPrice: Math.round(this.stockPrice * 100) / 100
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PeopleExpressEngine;
}
