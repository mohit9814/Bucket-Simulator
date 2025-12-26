import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { SimulationResult, FireMode } from "@/types";
import { formatINR } from "@/lib/utils"; // Assuming utils is in same folder, otherwise adjust
import { OptimizationResult } from "./optimizer";

interface ReportData {
    result: SimulationResult;
    params: {
        expense: number;
        mode: FireMode;
        years: number;
        inflation: number;
        isr: number;
        bucketAllocations: [number, number, number];

        startAge?: number;
        bucketConfigOverride?: { [key: number]: { returnRate: number, volatility: number } };
    };
}

export const ExportService = {
    downloadCSV: (data: ReportData) => {
        const { result, params } = data;
        const startAge = params.startAge;

        // 1. Summary Sheet
        const summary = [
            ["Parameter", "Value"],
            ["Monthly Expense", params.expense],
            ["Inflation Rate", `${params.inflation}%`],
            ["Simulation Years", params.years],
            ["ISR (Years of Expenses)", params.isr],
            ["Bucket Allocation", `${params.bucketAllocations.map(a => Math.round(a * 100)).join('/')}`],
            ["Success Rate", `${result.successRate.toFixed(1)}%`],
            ["Median Duration", `${(result.monthsLasted / 12).toFixed(1)} Years`],
            ["Final Corpus", result.finalAmount]
        ];

        // 2. History Sheet (Monthly Data)
        const history = result.history.map(row => {
            // Helper to calc approx %
            const startB3 = row.bucket3 - row.returnAmountB3 + row.pushToB2; // Skim from B3 is pushToB2
            const startB2 = row.bucket2 - row.returnAmountB2 + row.pushToB1; // Skim from B2 is pushToB1
            const startB1 = row.bucket1 - row.returnAmountB1; // Recycled to B1 (none)

            const pctB1 = startB1 > 0 ? (row.returnAmountB1 / startB1) * 100 : 0;
            const pctB2 = startB2 > 0 ? (row.returnAmountB2 / startB2) * 100 : 0;
            const pctB3 = startB3 > 0 ? (row.returnAmountB3 / startB3) * 100 : 0;

            const year = Math.floor((row.month - 1) / 12) + 1;

            return {
                Month: row.month,
                Age: startAge ? startAge + year - 1 : '-',
                Year: year,
                "B1 Bal": row.bucket1,
                "B1 Ret (Amt)": row.returnAmountB1,
                "B1 Ret (%)": `${pctB1.toFixed(2)}%`,
                "B1 Out": row.withdrawalB1,

                "B2 Bal": row.bucket2,
                "B2 Ret (Amt)": row.returnAmountB2,
                "B2 Ret (%)": `${pctB2.toFixed(2)}%`,
                "B2 Out": row.withdrawalB2,

                "B3 Bal": row.bucket3,
                "B3 Ret (Amt)": row.returnAmountB3,
                "B3 Ret (%)": `${pctB3.toFixed(2)}%`,
                "B3 Out": row.withdrawalB3,

                "Total Funds": row.totalFunds,
                "Tax Paid": row.taxPaid,
                "Trans (B3->B2)": row.pushToB2,
                "Trans (B2->B1)": row.pushToB1,
                "Pull (B2->B1)": row.pullToB1,
                "Pull (B3->B2)": row.pullToB2,
                "Rule Log": row.ruleLog
            };
        });

        const wb = XLSX.utils.book_new();
        const wsSummary = XLSX.utils.aoa_to_sheet(summary);
        const wsHistory = XLSX.utils.json_to_sheet(history);

        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
        XLSX.utils.book_append_sheet(wb, wsHistory, "Monthly Detail");

        // Scenario Analysis Sheet
        if (result.historyWorst && result.historyBest) {
            const getFinalFor = (h: any[]) => h.length > 0 ? h[h.length - 1].totalFunds : 0;
            const scenarios = [
                ["Scenario", "Final Corpus (Projected)"],
                ["Worst Case (10th Percentile)", getFinalFor(result.historyWorst)],
                ["25th Percentile", getFinalFor(result.historyP25!)],
                ["Median (50th Percentile)", result.finalAmount],
                ["75th Percentile", getFinalFor(result.historyP75!)],
                ["Best Case (90th Percentile)", getFinalFor(result.historyBest)]
            ];
            const wsScenarios = XLSX.utils.aoa_to_sheet(scenarios);
            XLSX.utils.book_append_sheet(wb, wsScenarios, "Scenario Analysis");

            // Scenario Details (Yearly)
            const scenarioDetails = result.history
                .map((_, i) => {
                    if (i % 12 !== 0) return null;
                    const year = Math.floor(i / 12) + 1;
                    const idx = i;

                    const getVal = (h: any[]) => h && h[idx] ? h[idx].totalFunds : 0;

                    return {
                        Year: year,
                        Age: startAge ? startAge + year - 1 : '-',
                        "Worst (10th)": getVal(result.historyWorst!),
                        "25th": getVal(result.historyP25!),
                        "Median": result.history[idx].totalFunds,
                        "75th": getVal(result.historyP75!),
                        "Best (90th)": getVal(result.historyBest!)
                    };
                })
                .filter(Boolean); // Remove nulls

            const wsScenarioDetails = XLSX.utils.json_to_sheet(scenarioDetails);
            XLSX.utils.book_append_sheet(wb, wsScenarioDetails, "Scenario Details");
        }

        XLSX.writeFile(wb, "Bucket_Simulator_Report.xlsx");
    },

    downloadPDF: (data: ReportData, charts?: { [key: string]: string }) => {
        const { result, params } = data;
        const startAge = params.startAge;
        const doc = new jsPDF();

        // 1. Header
        doc.setFontSize(22);
        doc.setTextColor(40, 116, 240); // Blue
        doc.text("Bucket Simulator Report", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 28);

        let currentY = 35;

        // 2. Simulation Parameters
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Simulation Parameters", 14, currentY);
        currentY += 5;

        autoTable(doc, {
            startY: currentY,
            head: [['Parameter', 'Value', 'Parameter', 'Value']],
            body: [
                ['Monthly Expense', formatINR(params.expense), 'Inflation', `${params.inflation}%`],
                ['Target Duration', `${params.years} Years`, 'ISR', `${params.isr}x`],
                ['Strategy', params.mode === 'Custom' ? 'Custom' : `${params.mode} FIRE`, 'Start Age', startAge ? `${startAge}` : '-'],
                ['Bucket Allocation', `${params.bucketAllocations.map(a => Math.round(a * 100)).join('/')}`, 'Rebalancing', params.mode === 'Custom' ? 'Annual' : '-']
            ],
            theme: 'striped',
            headStyles: { fillColor: [40, 116, 240] },
            styles: { fontSize: 10, cellPadding: 3 }
        });

        // @ts-ignore
        currentY = doc.lastAutoTable.finalY + 10;

        // 2b. Detailed Bucket Config (if custom)
        if (params.bucketConfigOverride) {
            const buckets = [
                { id: 1, name: "Bucket 1 (Cash)" },
                { id: 2, name: "Bucket 2 (Conservative)" },
                { id: 3, name: "Bucket 3 (Growth)" }
            ];

            const overrides = params.bucketConfigOverride;
            const configRows = buckets.map(b => {
                const ov = overrides[b.id];
                // Default vals (should technically come from constant but we put defaults or 'Default' text)
                const ret = ov ? `${(ov.returnRate * 100).toFixed(1)}%` : 'Default';
                const vol = ov ? `${(ov.volatility * 100).toFixed(1)}%` : 'Default';
                return [b.name, ret, vol];
            });

            // Show table only if at least one override exists? Or always?
            // Since the user asked for it, let's show it if variable is present
            doc.setFontSize(12);
            doc.text("Detailed Bucket Assumptions", 14, currentY);
            currentY += 5;

            autoTable(doc, {
                startY: currentY,
                head: [['Bucket', 'Return Rate', 'Volatility']],
                body: configRows,
                theme: 'striped',
                headStyles: { fillColor: [100, 100, 100] },
                styles: { fontSize: 9 }
            });
            // @ts-ignore
            currentY = doc.lastAutoTable.finalY + 10;
        }

        // 3. Projected Outcome
        doc.setFontSize(14);
        doc.text("Projected Outcome (Median Scenario)", 14, currentY);
        currentY += 5;

        autoTable(doc, {
            startY: currentY,
            head: [['Metric', 'Result']],
            body: [
                ['Success Probability', `${result.successRate.toFixed(1)}%`],
                ['Duration Lasted', `${(result.monthsLasted / 12).toFixed(1)} / ${params.years} Years`],
                ['Final Corpus (Projected)', formatINR(result.finalAmount)]
            ],
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74] } // Green
        });

        // @ts-ignore
        currentY = doc.lastAutoTable.finalY + 15;

        // 4. Scenario Analysis
        if (result.historyWorst && result.historyBest) {
            doc.setFontSize(14);
            doc.text("Scenario Analysis (Wealth Projection)", 14, currentY);
            currentY += 5;

            const getFinalFor = (h: any[]) => h.length > 0 ? h[h.length - 1].totalFunds : 0;
            const survived = (h: any[]) => h.length >= params.years * 12 ? 'Survived' : 'Depleted';

            autoTable(doc, {
                startY: currentY,
                head: [['Scenario', 'Percentile', 'Final Corpus', 'Outcome']],
                body: [
                    ['Worst Case', '10th', formatINR(getFinalFor(result.historyWorst)), survived(result.historyWorst)],
                    ['Below Average', '25th', formatINR(getFinalFor(result.historyP25!)), survived(result.historyP25!)],
                    ['Median', '50th', formatINR(result.finalAmount), 'Survived'],
                    ['Above Average', '75th', formatINR(getFinalFor(result.historyP75!)), 'Survived'],
                    ['Best Case', '90th', formatINR(getFinalFor(result.historyBest)), 'Survived']
                ],
                theme: 'striped',
                headStyles: { fillColor: [234, 88, 12] } // Orange
            });
            // @ts-ignore
            currentY = doc.lastAutoTable.finalY + 15;
        }

        // 5. Yearly Projection (Full Table)
        doc.addPage();
        doc.setFontSize(14);
        doc.text("Yearly Detailed Projection (Median)", 14, 20);

        const historyRows = result.history
            .filter((_, i) => i % 12 === 0) // Yearly only
            .map(row => {
                const yearIndex = Math.floor(row.month / 12);
                const ageVal = startAge ? startAge + yearIndex : '-';

                return [
                    ageVal,
                    yearIndex + 1, // Year 1, 2, ...
                    formatINR(row.bucket1),
                    formatINR(row.bucket2),
                    formatINR(row.bucket3),
                    formatINR(row.withdrawalB1 + row.withdrawalB2 + row.withdrawalB3),
                    formatINR(row.totalFunds)
                ]
            });

        autoTable(doc, {
            startY: 25,
            head: [['Age', 'Year', 'B1 Bal', 'B2 Bal', 'B3 Bal', 'Withdrawn', 'Total Wealth']],
            body: historyRows,
            theme: 'striped',
            styles: { fontSize: 9 },
            headStyles: { fontSize: 9, fillColor: [75, 85, 99] }
        });

        // 6. Charts
        if (charts) {
            let chartY = 20;
            // Add new page for charts
            doc.addPage();
            doc.setFontSize(16);
            doc.text("Visual Analytics", 14, chartY);
            chartY += 10;

            if (charts.wealthProjection) {
                doc.setFontSize(12);
                doc.text("Wealth Projection", 14, chartY);
                doc.addImage(charts.wealthProjection, 'PNG', 15, chartY + 5, 180, 100);
                chartY += 115;
            }
            if (charts.scenarioComparison) {
                if (chartY > 200) { doc.addPage(); chartY = 20; }
                doc.setFontSize(12);
                doc.text("Scenario Comparison", 14, chartY);
                doc.addImage(charts.scenarioComparison, 'PNG', 15, chartY + 5, 180, 100);
                chartY += 115;
            }
            if (charts.replenishmentVolume) {
                if (chartY > 200) { doc.addPage(); chartY = 20; }
                doc.setFontSize(12);
                doc.text("Replenishment Volume", 14, chartY);
                doc.addImage(charts.replenishmentVolume, 'PNG', 15, chartY + 5, 180, 100);
            }
        }

        // 7. Activity Log (Critical Events)
        doc.addPage();
        doc.setFontSize(14);
        doc.text("Major Activity Log", 14, 20);

        const logsData = result.history
            .filter(h => h.ruleLog && h.ruleLog.length > 0)
            .map(h => {
                const year = Math.ceil(h.month / 12);
                const age = startAge ? startAge + year - 1 : '-';
                return [age, year, h.ruleLog || ''];
            });

        autoTable(doc, {
            startY: 25,
            head: [['Age', 'Year', 'Event / Activity']],
            body: logsData.length > 0 ? logsData : [['-', '-', 'No major events recorded.']],
            theme: 'grid',
            styles: { fontSize: 10 },
            columnStyles: { 2: { cellWidth: 'auto' } }, // Events column wider
            headStyles: { fillColor: [50, 50, 50] }
        });

        doc.save("Bucket_Simulator_Report.pdf");
    },

    downloadOptimizerAnalysis: (results: OptimizationResult[]) => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(40, 116, 240); // Blue
        doc.text("Optimization Analysis", 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Comparative Analysis of Bucket Strategies`, 14, 26);

        // Best Strategy Highlights
        const best = results[0];
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(`Recommended: ${best.allocationName}`, 14, 40);
        doc.setFontSize(11);
        doc.text(`Requires ISR: ${best.isr}x (${formatINR(best.totalFundsRequired)})`, 14, 48);
        doc.text(`Success Probability: ${best.successRate.toFixed(1)}%`, 14, 54);

        // Comparative Table
        autoTable(doc, {
            startY: 65,
            head: [['Strategy', 'Required ISR', 'Corpus (₹)', 'Success Rate']],
            body: results.map(r => [
                r.allocationName,
                `${r.isr}x`,
                formatINR(r.totalFundsRequired),
                `${r.successRate.toFixed(1)}%`
            ]),
            theme: 'grid',
            headStyles: { fillColor: [66, 66, 66] }
        });

        doc.save("Optimizer_Analysis.pdf");
    }
};
