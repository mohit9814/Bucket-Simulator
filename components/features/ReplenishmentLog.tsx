"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatINR } from "@/lib/utils";
import { MonthSimulation } from "@/types";
import { ArrowRight, RefreshCw, TrendingUp, Activity, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ReplenishmentLogProps {
    history: MonthSimulation[];
}

export function ReplenishmentLog({ history }: ReplenishmentLogProps) {
    if (!history || history.length === 0) return null;

    // 1. Process Data
    let totalFromGrowth = 0;
    let totalFromConservative = 0;
    let yearsWithActivity = 0;

    const yearlyData = history.reduce((acc, monthSim) => {
        const year = Math.floor(monthSim.month / 12);
        if (!acc[year]) {
            acc[year] = {
                year,
                skimToB1: 0,
                skimToB2: 0,
                rules: new Set<string>()
            };
        }

        acc[year].skimToB1 += monthSim.skimToB1;
        acc[year].skimToB2 += monthSim.skimToB2;

        if (monthSim.ruleLog) {
            monthSim.ruleLog.split('|').forEach(r => {
                if (r.trim()) acc[year].rules.add(r.trim())
            });
        }

        return acc;
    }, {} as Record<number, { year: number; skimToB1: number; skimToB2: number; rules: Set<string> }>);

    const chartData = Object.values(yearlyData).map(d => {
        totalFromGrowth += d.skimToB2;
        totalFromConservative += d.skimToB1;
        if (d.skimToB1 > 0 || d.skimToB2 > 0) yearsWithActivity++;

        return {
            name: `Yr ${d.year + 1}`,
            "From Growth (B3)": Math.round(d.skimToB2),
            "From Conservative (B2)": Math.round(d.skimToB1),
            yearRaw: d.year
        };
    });

    const activeYears = Object.values(yearlyData).filter(d => d.skimToB1 > 100 || d.skimToB2 > 100 || d.rules.size > 0);

    // Custom Tooltip for Chart
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 border border-slate-200 p-3 rounded-lg shadow-lg text-xs">
                    <p className="font-bold mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        entry.value > 0 && (
                            <div key={index} className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-muted-foreground">{entry.name}:</span>
                                <span className="font-mono font-medium">{formatINR(entry.value)}</span>
                            </div>
                        )
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 w-full">

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="glass-card bg-indigo-50/50 border-indigo-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider">Total Equity Sold (B3)</p>
                            <h3 className="text-2xl font-bold text-indigo-900 mt-1">{formatINR(totalFromGrowth)}</h3>
                        </div>
                        <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass-card bg-emerald-50/50 border-emerald-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Total Cash Replenished (B1)</p>
                            <h3 className="text-2xl font-bold text-emerald-900 mt-1">{formatINR(totalFromConservative)}</h3>
                        </div>
                        <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Visual Chart */}
            <Card className="glass-card">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" />
                        Replenishment Volume
                    </CardTitle>
                    <CardDescription>Visualizing capital flow between buckets over time</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                            <XAxis
                                dataKey="name"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => `₹${(val / 100000).toFixed(0)}L`}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            <Bar name="From Growth (B3)" dataKey="From Growth (B3)" stackId="a" fill="#4f46e5" radius={[0, 0, 4, 4]} />
                            <Bar name="From Conservative (B2)" dataKey="From Conservative (B2)" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Detailed Event Grid */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Activity Log ({activeYears.length} Events)
                </h4>

                {activeYears.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground bg-slate-50/50">
                        No major replenishment events required.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {activeYears.map((event) => (
                            <Card key={event.year} className="border bg-card/50 hover:bg-card transition-colors">
                                <CardHeader className="p-3 pb-2 border-b bg-muted/20">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-semibold">Year {event.year + 1}</CardTitle>
                                        <span className="text-[10px] text-muted-foreground font-mono">Age {50 + event.year}</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-3 space-y-2">
                                    {event.rules.size > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {Array.from(event.rules).map(r => (
                                                <span key={r} className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded border border-blue-200 font-medium">
                                                    {r}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {event.skimToB2 > 0 && (
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-1.5 text-indigo-700">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                B3 <ArrowRight className="w-3 h-3" /> B2
                                            </div>
                                            <span className="font-mono font-medium">{formatINR(event.skimToB2)}</span>
                                        </div>
                                    )}

                                    {event.skimToB1 > 0 && (
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-1.5 text-emerald-700">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                B2 <ArrowRight className="w-3 h-3" /> B1
                                            </div>
                                            <span className="font-mono font-medium">{formatINR(event.skimToB1)}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
