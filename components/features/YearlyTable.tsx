"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatINR } from "@/lib/utils";
import { MonthSimulation } from "@/types";
import { Download, Table as TableIcon, ArrowRight, ArrowLeft, ArrowDown, Info } from "lucide-react";

interface YearlyTableProps {
    history: MonthSimulation[];
    currentMonth: number;
    startAge?: number;
}

export function YearlyTable({ history, currentMonth, startAge }: YearlyTableProps) {
    if (!history || history.length === 0) return null;

    // Filter history up to currentMonth
    const visibleHistory = history.slice(0, currentMonth);

    const yearlyData = visibleHistory.reduce((acc, monthSim) => {
        // ... (keep existing reduce logic verbatim, but skipping re-paste to save tokens if possible? No, I must replace contiguous block)
        // Actually, reducing logic is fine, I just need to update usage of it.
        // Wait, I need to replace the interface and the CSV handler.
        // I will replace the top part including interface and CSV handler.

        // Year 0 based on index 0-11
        const year = Math.floor((monthSim.month - 1) / 12);

        if (!acc[year]) {
            acc[year] = {
                year,
                endB1: 0,
                endB2: 0,
                endB3: 0,
                returnAmountB1: 0,
                returnAmountB2: 0,
                returnAmountB3: 0,
                inflowB1: 0, outflowB1: 0,
                inflowB2: 0, outflowB2: 0,
                inflowB3: 0, outflowB3: 0,

                // Track Withdrawals Specifically for UI
                wB1: 0, wB2: 0, wB3: 0, tax: 0,

                // Track Skims for Return Calculation
                totalPushToB1: 0, // Skim from B2 -> B1
                totalPushToB2: 0, // Skim from B3 -> B2
            };
        }
        // Update End balances continuously (last one wins)
        acc[year].endB1 = monthSim.bucket1;
        acc[year].endB2 = monthSim.bucket2;
        acc[year].endB3 = monthSim.bucket3;

        // Sum returns
        acc[year].returnAmountB1 += monthSim.returnAmountB1;
        acc[year].returnAmountB2 += monthSim.returnAmountB2;
        acc[year].returnAmountB3 += monthSim.returnAmountB3;

        // Sum Tax
        if (monthSim.taxPaid) acc[year].tax += monthSim.taxPaid;

        // Sum Flows for Start Balance Reconstruction
        // B1 Inflow: Push/Pull from B2
        // B1 Outflow: Withdrawal
        const inB1 = monthSim.pushToB1 + monthSim.pullToB1;
        const outB1 = monthSim.withdrawalB1;

        acc[year].inflowB1 += inB1;
        acc[year].outflowB1 += outB1;
        acc[year].wB1 += monthSim.withdrawalB1;

        // B2 Inflow: Push/Pull from B3
        // B2 Outflow: Push/Pull to B1 + Withdrawal
        const inB2 = monthSim.pushToB2 + monthSim.pullToB2;
        const outB2 = monthSim.pushToB1 + monthSim.pullToB1 + monthSim.withdrawalB2;

        acc[year].inflowB2 += inB2;
        acc[year].outflowB2 += outB2;
        acc[year].wB2 += monthSim.withdrawalB2;

        // Track Skims
        acc[year].totalPushToB1 += monthSim.pushToB1;
        acc[year].totalPushToB2 += monthSim.pushToB2;

        // B3 Inflow: 0
        // B3 Outflow: Push/Pull to B2 + Withdrawal
        const inB3 = 0;
        const outB3 = monthSim.pushToB2 + monthSim.pullToB2 + monthSim.withdrawalB3;

        acc[year].inflowB3 += inB3;
        acc[year].outflowB3 += outB3;
        acc[year].wB3 += monthSim.withdrawalB3;

        return acc;
    }, {} as Record<number, {
        year: number;
        endB1: number; endB2: number; endB3: number;
        returnAmountB1: number; returnAmountB2: number; returnAmountB3: number;
        inflowB1: number; outflowB1: number;
        inflowB2: number; outflowB2: number;
        inflowB3: number; outflowB3: number;
        wB1: number; wB2: number; wB3: number; tax: number;
        totalPushToB1: number; totalPushToB2: number;
    }>);

    const rows = Object.values(yearlyData);

    // Download CSV Handler
    const handleDownload = () => {
        const headers = ["Age", "Year", "B1 Bal", "B1 Ret", "B1 Out", "B2 Bal", "B2 Ret", "B2 Out", "B3 Bal", "B3 Ret", "B3 Out", "Tax Paid"];
        const csvContent = [
            headers.join(","),
            ...rows.map(r => [
                startAge ? startAge + r.year : '-',
                r.year + 1,
                r.endB1.toFixed(2),
                r.returnAmountB1.toFixed(2),
                r.wB1.toFixed(2),
                r.endB2.toFixed(2),
                r.returnAmountB2.toFixed(2),
                r.wB2.toFixed(2),
                r.endB3.toFixed(2),
                r.returnAmountB3.toFixed(2),
                r.wB3.toFixed(2),
                r.tax.toFixed(2)
            ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "simulation_results.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Helper for return color
    const getReturnColor = (amt: number) => {
        if (amt > 0) return "text-emerald-600";
        if (amt < 0) return "text-red-600";
        return "text-muted-foreground";
    };

    // Robust Percentage Calculation
    const calcRate = (ret: number, capitalBase: number) => {
        if (capitalBase <= 1) return 0;
        return (ret / capitalBase) * 100;
    }

    return (
        <Card className="glass-card w-full min-h-[800px] h-full flex flex-col border-none shadow-none bg-transparent">
            <CardHeader className="pb-2 flex flex-col space-y-2 px-0">
                <div className="flex flex-row items-center justify-between w-full">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <TableIcon className="w-4 h-4 text-primary" />
                        Yearly Details
                    </CardTitle>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleDownload} className="h-7 gap-1 text-xs">
                            <Download className="w-3 h-3" />
                            CSV
                        </Button>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground bg-muted/30 p-2 rounded-md border border-border/50 hidden md:flex">
                    <div className="flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        <span className="font-semibold">Legend:</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-emerald-600 font-bold">Tr</span> = <span className="text-emerald-600">Replenishment</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-amber-600 font-bold">Out</span> = Withdrawal
                    </div>
                    <div className="flex items-center gap-1">
                        <span>Ret = Return</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <ArrowLeft className="w-3 h-3 text-emerald-600" />
                        <span>Flow Direction</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0 scrollbar-hide">
                <div className="w-full">
                    <table className="w-full text-xs text-left border-collapse table-fixed">
                        {/* Mobile ColGroup */}
                        <colgroup className="md:hidden">
                            <col className="w-[15%]" />
                            <col className="w-[10%]" />
                            <col className="w-[40%]" />
                            <col className="w-[35%]" />
                        </colgroup>
                        {/* Desktop ColGroup */}
                        <colgroup className="hidden md:table-column-group">
                            <col className="w-10" />
                            <col className="w-8" />
                            <col className="w-[12%]" />
                            <col className="w-[11%]" />
                            <col className="w-[8%]" />
                            <col className="w-8" />
                            <col className="w-[12%]" />
                            <col className="w-[11%]" />
                            <col className="w-8" />
                            <col className="w-[12%]" />
                            <col className="w-[11%]" />
                            <col className="w-10" />
                        </colgroup>
                        <thead className="sticky top-0 bg-secondary/90 backdrop-blur z-10 text-muted-foreground font-semibold">
                            <tr>
                                <th className="p-1 pl-2 sticky left-0 bg-secondary/90 z-20" title="Age">Age</th>
                                <th className="p-1 text-center sticky left-[40px] md:static bg-secondary/90 z-20 md:border-r border-border/50" title="Year">Yr</th>

                                {/* Mobile Only Columns */}
                                <th className="p-1 text-right md:hidden" title="Total Balance">Total Bal</th>
                                <th className="p-1 text-right md:hidden text-amber-600/90" title="Total Withdrawal">Withdrawn</th>


                                {/* Desktop Only Columns */}
                                <th className="hidden md:table-cell p-1 text-right border-l border-border/50" title="Bucket 1 Ending Balance">B1 Bal</th>
                                <th className="hidden md:table-cell p-1 text-right" title="Return Amount (+/-)">Ret</th>
                                <th className="hidden md:table-cell p-1 text-right text-amber-600/90" title="Withdrawal Amount">Out</th>

                                <th className="hidden md:table-cell p-1 text-center text-emerald-600/90" title="Transfer: Money moved FROM Bucket 2 TO Bucket 1">Tr</th>

                                <th className="hidden md:table-cell p-1 text-right border-l border-border/50" title="Bucket 2 Ending Balance">B2 Bal</th>
                                <th className="hidden md:table-cell p-1 text-right" title="Return Amount (+/-)">Ret</th>

                                <th className="hidden md:table-cell p-1 text-center text-emerald-600/90" title="Transfer: Money moved FROM Bucket 3 TO Bucket 2">Tr</th>

                                <th className="hidden md:table-cell p-1 text-right border-l border-border/50" title="Bucket 3 Ending Balance">B3 Bal</th>
                                <th className="hidden md:table-cell p-1 text-right" title="Return Amount (+/-)">Ret</th>

                                <th className="hidden md:table-cell p-1 text-right border-l border-border/50 text-red-600/90" title="Tax Paid on Withdrawals/Gains">Tax</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y relative">
                            {rows.map((row) => {
                                // B1: Capital = End - Ret
                                const pctB1 = calcRate(row.returnAmountB1, row.endB1 - row.returnAmountB1);

                                // B2: Capital = End - Ret + SkimToB1 (Post-return outflow)
                                const pctB2 = calcRate(row.returnAmountB2, row.endB2 - row.returnAmountB2 + row.totalPushToB1);

                                // B3: Capital = End - Ret + SkimToB2 (Post-return outflow)
                                const pctB3 = calcRate(row.returnAmountB3, row.endB3 - row.returnAmountB3 + row.totalPushToB2);

                                const totalBal = row.endB1 + row.endB2 + row.endB3;
                                const totalW = row.wB1 + row.wB2 + row.wB3;

                                return (
                                    <tr key={row.year} className="hover:bg-muted/30 group transition-colors odd:bg-background even:bg-secondary/10">
                                        <td className="p-1 pl-2 font-medium sticky left-0 bg-background group-hover:bg-muted/30 transition-colors">
                                            {startAge ? startAge + row.year : '-'}
                                        </td>
                                        <td className="p-1 text-center font-medium sticky left-[40px] md:static bg-background group-hover:bg-muted/30 transition-colors md:border-r border-border/50">
                                            {row.year + 1}
                                        </td>

                                        {/* Mobile Only: Total Bal & Withdrawal */}
                                        <td className="p-1 text-right font-mono font-bold md:hidden">
                                            {formatINR(totalBal)}
                                        </td>
                                        <td className="p-1 text-right font-mono text-amber-700 md:hidden">
                                            {formatINR(totalW)}
                                        </td>

                                        {/* Desktop Only: Bucket Details */}

                                        {/* Bucket 1 */}
                                        <td className="hidden md:table-cell p-1 text-right font-mono text-muted-foreground border-l border-border/50 whitespace-nowrap">
                                            {formatINR(row.endB1)}
                                        </td>
                                        <td className={cn("hidden md:table-cell p-1 text-right font-mono whitespace-nowrap", getReturnColor(row.returnAmountB1))}>
                                            <div>{formatINR(row.returnAmountB1)}</div>
                                            <div className="text-[10px] opacity-70">
                                                {row.returnAmountB1 > 0 ? "+" : ""}{pctB1.toFixed(1)}%
                                            </div>
                                        </td>
                                        <td className="hidden md:table-cell p-1 text-right font-mono text-amber-700/80 whitespace-nowrap">
                                            {formatINR(row.wB1)}
                                        </td>

                                        {/* Transfer B2 -> B1 */}
                                        <td className="hidden md:table-cell p-1 text-center border-l border-border/30">
                                            {row.totalPushToB1 > 100 ? (
                                                <div className="flex flex-col items-center justify-center">
                                                    <div className="text-[10px] text-emerald-600 font-semibold flex items-center">
                                                        <ArrowLeft className="w-3 h-3 mr-0.5" />
                                                    </div>
                                                    <span className="text-[10px] text-emerald-600/80">{formatINR(row.totalPushToB1)}</span>
                                                </div>
                                            ) : (
                                                <span className="text-secondary-foreground/20">-</span>
                                            )}
                                        </td>

                                        {/* Bucket 2 */}
                                        <td className="hidden md:table-cell p-1 text-right font-mono text-muted-foreground border-l border-border/50 whitespace-nowrap">
                                            {formatINR(row.endB2)}
                                            {row.wB2 > 100 && (
                                                <div className="text-[10px] text-red-500 flex justify-end items-center" title="Direct Withdrawal">
                                                    <ArrowDown className="w-2.5 h-2.5 mr-0.5" />
                                                    {formatINR(row.wB2)}
                                                </div>
                                            )}
                                        </td>
                                        <td className={cn("hidden md:table-cell p-1 text-right font-mono whitespace-nowrap", getReturnColor(row.returnAmountB2))}>
                                            <div>{formatINR(row.returnAmountB2)}</div>
                                            <div className="text-[10px] opacity-70">
                                                {row.returnAmountB2 > 0 ? "+" : ""}{pctB2.toFixed(1)}%
                                            </div>
                                        </td>

                                        {/* Transfer B3 -> B2 */}
                                        <td className="hidden md:table-cell p-1 text-center border-l border-border/30">
                                            {row.totalPushToB2 > 100 ? (
                                                <div className="flex flex-col items-center justify-center">
                                                    <div className="text-[10px] text-emerald-600 font-semibold flex items-center">
                                                        <ArrowLeft className="w-3 h-3 mr-0.5" />
                                                    </div>
                                                    <span className="text-[10px] text-emerald-600/80">{formatINR(row.totalPushToB2)}</span>
                                                </div>
                                            ) : (
                                                <span className="text-secondary-foreground/20">-</span>
                                            )}
                                        </td>

                                        {/* Bucket 3 */}
                                        <td className="hidden md:table-cell p-1 text-right font-mono text-muted-foreground border-l border-border/50 whitespace-nowrap">
                                            {formatINR(row.endB3)}
                                            {row.wB3 > 100 && (
                                                <div className="text-[10px] text-red-500 flex justify-end items-center" title="Direct Withdrawal">
                                                    <ArrowDown className="w-2.5 h-2.5 mr-0.5" />
                                                    {formatINR(row.wB3)}
                                                </div>
                                            )}
                                        </td>
                                        <td className={cn("hidden md:table-cell p-1 text-right font-mono whitespace-nowrap", getReturnColor(row.returnAmountB3))}>
                                            <div>{formatINR(row.returnAmountB3)}</div>
                                            <div className="text-[10px] opacity-70">
                                                {row.returnAmountB3 > 0 ? "+" : ""}{pctB3.toFixed(1)}%
                                            </div>
                                        </td>

                                        {/* Tax */}
                                        <td className="hidden md:table-cell p-1 text-right font-mono text-red-600/70 border-l border-border/50 font-semibold text-[10px] whitespace-nowrap">
                                            {row.tax > 0 ? formatINR(row.tax) : '-'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
