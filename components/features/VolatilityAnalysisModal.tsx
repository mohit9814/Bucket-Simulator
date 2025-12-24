"use client"

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { calculateRequiredFunds, runSimulation } from "@/lib/simulation";
import { SimulationResult, FireMode } from "@/types";
import { BUCKETS } from "@/lib/constants";
import { Loader2 } from "lucide-react";

interface VolatilityAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentParams: {
        expense: number;
        mode: FireMode;
        years: number;
        inflation: number;
        bucketAllocations: [number, number, number];
        startAge?: number;
        taxEnabled?: boolean;
        isJoint?: boolean;
        annualRebalancing?: boolean;
        bucketConfigOverride?: { [key: number]: { returnRate: number, volatility: number } };
    } | null;
}

export function VolatilityAnalysisModal({ isOpen, onClose, currentParams }: VolatilityAnalysisModalProps) {
    const [data, setData] = useState<{ volatility: number; minISR: number }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (isOpen && currentParams) {
            runAnalysis();
        }
    }, [isOpen]);

    const runAnalysis = async () => {
        if (!currentParams) return;
        setIsLoading(true);
        setData([]);
        setProgress(0);

        // Define range for Volatility with higher precision in sweet spot (9-15%)
        const volSteps: number[] = [];
        // 5% to 8% (1% steps)
        for (let v = 5; v < 9; v += 1) volSteps.push(v);
        // 9% to 15% (0.5% steps)
        for (let v = 9; v <= 15; v += 0.5) volSteps.push(v);
        // 16% to 25% (1% steps)
        for (let v = 16; v <= 25; v += 1) volSteps.push(v);

        const results: { volatility: number; minISR: number }[] = [];
        const targetSuccess = 90;
        const numSimulations = 250; // Optimized count for speed vs precision

        // B3 Start Return (use override or default)
        const defaultB3 = BUCKETS.find(b => b.id === 3)!;
        const currentB3Return = currentParams.bucketConfigOverride?.[3]?.returnRate ?? defaultB3.returnRate;

        let lowerBoundSearch = 15; // Start searching from reasonable low

        // Process sequentially to avoid blocking UI too much (using small timeouts)
        for (let i = 0; i < volSteps.length; i++) {
            const vol = volSteps[i];

            // Binary Search for minISR where Success >= 90%
            // Range [lowerBoundSearch, 100]
            let low = lowerBoundSearch;
            let high = 100;
            let foundISR = 100;

            // Heuristic Upper Bound Check first to avoid search if clean
            // Check high (100) first? No, binary search matches it.

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);

                const totalFunds = calculateRequiredFunds(currentParams.expense, mid);

                // Construct override just for this run
                const override = {
                    ...currentParams.bucketConfigOverride,
                    3: { returnRate: currentB3Return, volatility: vol / 100 }
                };

                const simResult = runSimulation({
                    totalFunds,
                    monthlyExpense: currentParams.expense,
                    years: currentParams.years,
                    inflationRate: currentParams.inflation,
                    numSimulations: numSimulations,
                    bucketAllocations: currentParams.bucketAllocations,
                    startAge: currentParams.startAge,
                    taxEnabled: currentParams.taxEnabled,
                    isJoint: currentParams.isJoint,
                    annualRebalancing: currentParams.annualRebalancing,
                    bucketConfigOverride: override
                });

                if (simResult.successRate >= targetSuccess) {
                    foundISR = mid;
                    high = mid - 1; // Try lower
                } else {
                    low = mid + 1; // Need more buffer
                }
            }

            // Optimization: The next volatility level will likely strictly require >= this ISR
            // So we can start the next search from this found value (minus small buffer if noisy)
            lowerBoundSearch = Math.max(15, foundISR - 5);

            results.push({ volatility: vol, minISR: foundISR });

            setData([...results]);
            setProgress(Math.round(((i + 1) / volSteps.length) * 100));

            // Yield to UI
            await new Promise(r => setTimeout(r, 0));
        }

        setIsLoading(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isLoading && onClose()}>
            <DialogContent className="max-w-4xl bg-white text-slate-900 border-slate-200">
                <div className="space-y-2 mb-4">
                    <h2 className="text-xl font-semibold tracking-tight">B3 Volatility Impact Analysis</h2>
                    <p className="text-sm text-muted-foreground">
                        Analyzing how Bucket 3 volatility affects the required corpus (ISR) to maintain an 90% success rate.
                    </p>
                </div>

                <div className="py-2">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center space-y-4 h-[400px]">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-muted-foreground">Running simulations... {progress}%</p>
                        </div>
                    )}

                    {!isLoading && data.length > 0 && (
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                    <defs>
                                        <linearGradient id="colorIsr" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                    <XAxis
                                        dataKey="volatility"
                                        // Tick formatter must be simple string
                                        tickFormatter={(v) => `${v}%`}
                                        label={{ value: "Bucket 3 Volatility", position: "insideBottom", offset: -10 }}
                                    />
                                    <YAxis
                                        domain={['auto', 'auto']}
                                        label={{ value: "Required ISR (x)", angle: -90, position: "insideLeft" }}
                                    />
                                    <Tooltip
                                        formatter={(val: any) => [Number(val).toFixed(2) + "x", "Minimum ISR"]}
                                        labelFormatter={(val) => `Volatility: ${val}%`}
                                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="minISR"
                                        stroke="#8884d8"
                                        fillOpacity={1}
                                        fill="url(#colorIsr)"
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                            <div className="mt-4 p-4 bg-slate-50 rounded-lg text-sm text-slate-700 border border-slate-100">
                                <p>
                                    <strong>Interpretation:</strong> This chart shows the minimum "Income Replacement Ratio" (Corpus Multiplier) needed to achieve an 90% success rate for different levels of Bucket 3 volatility.
                                </p>
                                <p className="mt-2">
                                    Lower volatility typically allows for a more predictable outcome, often requiring a slightly smaller initial corpus (lower ISR) to achieve the same 90% success probability.
                                </p>
                            </div>
                        </div>
                    )}

                    {!isLoading && data.length === 0 && (
                        <div className="flex items-center justify-center h-[400px] text-muted-foreground border-2 border-dashed rounded-lg">
                            <p>Initializing...</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
