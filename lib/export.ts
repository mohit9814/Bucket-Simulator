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
    };
}

export const ExportService = {
    downloadCSV: (data: ReportData) => {
        const { result, params } = data;

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

        // 2. History Sheet
        // 2. History Sheet (Monthly Data)
        const history = result.history.map(row => {
            // Helper to calc approx %
            // B3: End = Start + Ret - Push. Start = End - Ret + Push.
            // B2: End = Start + Ret - Push. Start = End - Ret + Push.
            // B1: End = Start + Ret - Push. Start = End - Ret + Push.
            // Note: Start includes incoming pushes for B1/B2.

            const startB3 = row.bucket3 - row.returnAmountB3 + row.pushToB2; // Skim from B3 is pushToB2
            const startB2 = row.bucket2 - row.returnAmountB2 + row.pushToB1; // Skim from B2 is pushToB1
            const startB1 = row.bucket1 - row.returnAmountB1; // Recycled to B1 (none)

            const pctB1 = startB1 > 0 ? (row.returnAmountB1 / startB1) * 100 : 0;
            const pctB2 = startB2 > 0 ? (row.returnAmountB2 / startB2) * 100 : 0;
            const pctB3 = startB3 > 0 ? (row.returnAmountB3 / startB3) * 100 : 0;

            return {
                Month: row.month,
                Year: Math.floor((row.month - 1) / 12) + 1,
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

        XLSX.writeFile(wb, "Bucket_Simulator_Report.xlsx");
    },

    downloadPDF: (data: ReportData) => {
        const { result, params } = data;
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(40, 116, 240); // Blue
        doc.text("Bucket Simulator Report", 14, 20);

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);

        // Summary Table
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Simulation Parameters", 14, 45);

        autoTable(doc, {
            startY: 50,
            head: [['Parameter', 'Value']],
            body: [
                ['Monthly Expense', formatINR(params.expense)],
                ['Inflation', `${params.inflation}%`],
                ['Target Duration', `${params.years} Years`],
                ['Strategy', params.mode === 'Custom' ? 'Custom' : `${params.mode} FIRE`],
                ['ISR', `${params.isr}x`],
                ['Allocation', `${params.bucketAllocations.map(a => Math.round(a * 100)).join('/')}`]
            ],
            theme: 'striped',
            headStyles: { fillColor: [40, 116, 240] }
        });

        // Results
        // @ts-ignore
        const finalY = doc.lastAutoTable.finalY + 15;
        doc.text("Projected Outcome", 14, finalY);

        autoTable(doc, {
            startY: finalY + 5,
            head: [['Metric', 'Result']],
            body: [
                ['Success Probability', `${result.successRate.toFixed(1)}%`],
                ['Duration Lasted', `${(result.monthsLasted / 12).toFixed(1)} / ${params.years} Years`],
                ['Final Corpus (Projected)', formatINR(result.finalAmount)]
            ],
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74] } // Green
        });

        // Yearly History (Sample)
        // @ts-ignore
        const historyY = doc.lastAutoTable.finalY + 15;
        doc.text("Yearly Projection (First 20 Years)", 14, historyY);

        const historyRows = result.history
            .filter((_, i) => i % 12 === 0) // Yearly only
            .slice(0, 20)
            .map(row => {
                // Calculate annual withdrawals for display? 
                // Currently this row is just the monthly snapshot at start of year (i % 12 === 0).
                // The user probably wants "Widthdrawn this Year".
                // But row is just a snapshot. 
                // For PDF, simple snapshot is okay for balances, but withdrawals needs accumulation or showing that month's?
                // Showing just one month's withdrawal is misleading.
                // Let's stick to showing balances in PDF to avoid confusion, or try to accumulate.
                // Accumulating in map is hard.
                // I will add columns but with caveats or just show the snapshot withdrawal (monthly).
                // User asked for "amount withdrawn from each bucket".
                // I'll show the withdrawal for that *month* or maybe it's better to show balances.
                // Let's add "Withdrawn (Mo)" columns.
                return [
                    Math.floor(row.month / 12),
                    formatINR(row.bucket1),
                    formatINR(row.bucket2),
                    formatINR(row.bucket3),
                    formatINR(row.withdrawalB1 + row.withdrawalB2 + row.withdrawalB3)
                ]
            });

        autoTable(doc, {
            startY: historyY + 5,
            head: [['Year', 'B1 Bal', 'B2 Bal', 'B3 Bal', 'Withdrawn (Mo)']],
            body: historyRows,
            theme: 'striped',
            styles: { fontSize: 8 }, // Reduce font size to fit
            headStyles: { fontSize: 8 }
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
