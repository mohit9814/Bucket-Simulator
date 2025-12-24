import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findOptimalStrategy, analyzeFixedIsrStrategies, OptimizationResult } from "@/lib/optimizer";
import { Loader2, ArrowRight, CheckCircle2, Sparkles, Download, RefreshCw, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { ExportService } from "@/lib/export";
import { formatINR } from "@/lib/utils";
import { BUCKETS } from "@/lib/constants";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StrategyType } from "@/types";

interface OptimizerResultsProps {
    monthlyExpense: number;
    inflationRate: number;
    years: number;
    strategyType: StrategyType;
    onApplyStrategy: (
        isr: number,
        allocation: [number, number, number],
        updatedParams?: { expense: number, inflation: number, years: number },
        overrides?: { [key: number]: { returnRate: number, volatility: number } },
        strategyType?: StrategyType
    ) => void;
}

export function OptimizerResults({ monthlyExpense, inflationRate, years, strategyType, onApplyStrategy }: OptimizerResultsProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<OptimizationResult[] | null>(null);

    // Local state for interactive optimization
    const [localExpense, setLocalExpense] = useState(monthlyExpense);
    const [localInflation, setLocalInflation] = useState(inflationRate);
    const [localYears, setLocalYears] = useState(years);

    // Advanced Mode State
    const [optimizationMode, setOptimizationMode] = useState<'find-optimal' | 'fixed-isr'>('find-optimal');
    const [fixedIsr, setFixedIsr] = useState(45);
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    // Bucket Overrides
    const [bucketOverrides, setBucketOverrides] = useState<{ [key: number]: { returnRate: number, volatility: number } }>({
        1: { returnRate: BUCKETS[0].returnRate, volatility: BUCKETS[0].volatility },
        2: { returnRate: BUCKETS[1].returnRate, volatility: BUCKETS[1].volatility },
        3: { returnRate: BUCKETS[2].returnRate, volatility: BUCKETS[2].volatility }
    });
    const [useRebalancing, setUseRebalancing] = useState<boolean>(false);

    const handleOptimize = async () => {
        setIsLoading(true);
        setResults(null); // Clear previous results when optimizing
        // Small delay to allow UI to render loading state
        setTimeout(async () => {
            try {
                let optimalStrategies: OptimizationResult[] = [];

                if (optimizationMode === 'find-optimal') {
                    optimalStrategies = await findOptimalStrategy(localExpense, localInflation, localYears, undefined, bucketOverrides, useRebalancing, strategyType);
                } else {
                    optimalStrategies = await analyzeFixedIsrStrategies(localExpense, localInflation, localYears, fixedIsr, bucketOverrides, useRebalancing, strategyType);
                }

                setResults(optimalStrategies);
            } catch (error) {
                console.error("Optimization failed", error);
            } finally {
                setIsLoading(false);
            }
        }, 100);
    };

    // Initial run on mount if not ran yet
    useEffect(() => {
        if (!results) {
            handleOptimize();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const updateBucketOverride = (id: number, field: 'returnRate' | 'volatility', value: number) => {
        setBucketOverrides(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    if (results === null && !isLoading) { // Initial state before any optimization runs
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
                <p className="text-lg font-medium">Initializing...</p>
            </div>
        );
    }

    const applyParams = {
        expense: localExpense,
        inflation: localInflation,
        years: localYears
    };

    return (
        <div className="w-full h-full flex flex-col p-6 lg:p-12 overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Optimization Analysis</h2>
                    <p className="text-muted-foreground">
                        {optimizationMode === 'find-optimal'
                            ? "Finding the most efficient strategies for >90% success."
                            : `Analyzing strategy performance at exactly ${fixedIsr}x expenses.`
                        }
                    </p>
                </div>
                <div className="flex gap-2">
                    {/* Advanced Settings Toggle */}
                    <Button variant="outline" onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}>
                        <Settings2 className="w-4 h-4 mr-2" /> Advanced Config
                        {isAdvancedOpen ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
                    </Button>
                    {results && (
                        <Button variant="outline" onClick={() => ExportService.downloadOptimizerAnalysis(results)}>
                            <Download className="mr-2 h-4 w-4" /> Export
                        </Button>
                    )}
                </div>
            </div>

            {/* Advanced Settings Panel */}
            <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen} className="mb-6 space-y-4">
                <CollapsibleContent>
                    <Card className="bg-slate-50 dark:bg-slate-900 border-dashed">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Bucket Assumptions Override</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[1, 2, 3].map(id => (
                                <div key={id} className="space-y-3">
                                    <div className="flex items-center gap-2 font-semibold text-sm">
                                        <div className={`w-3 h-3 rounded-full ${id === 1 ? 'bg-blue-500' : id === 2 ? 'bg-indigo-500' : 'bg-purple-500'}`} />
                                        Bucket {id} Params
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-xs">Return (%)</Label>
                                            <Input
                                                type="number"
                                                value={bucketOverrides[id].returnRate * 100} // Display as %
                                                onChange={(e) => updateBucketOverride(id, 'returnRate', Number(e.target.value) / 100)}
                                                className="h-8 bg-white dark:bg-black"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Vol (%)</Label>
                                            <Input
                                                type="number"
                                                value={bucketOverrides[id].volatility * 100}
                                                onChange={(e) => updateBucketOverride(id, 'volatility', Number(e.target.value) / 100)}
                                                className="h-8 bg-white dark:bg-black"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="bg-white dark:bg-slate-950 mt-4 border-slate-200 dark:border-slate-800 shadow-sm">
                        <CardContent className="p-4 flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="optRebalancing"
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={useRebalancing}
                                onChange={(e) => setUseRebalancing(e.target.checked)}
                            />
                            <div className="grid gap-1.5 leading-none">
                                <label
                                    htmlFor="optRebalancing"
                                    className="text-sm font-medium leading-none cursor-pointer"
                                >
                                    Enable Annual Rebalancing
                                </label>
                                <p className="text-[10px] text-muted-foreground">
                                    Resets allocations to target % every year during optimization.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </CollapsibleContent>
            </Collapsible>

            {/* Input Controls Card */}
            <Card className="bg-white dark:bg-slate-950 mb-8 border-slate-200 dark:border-slate-800 shadow-sm">
                <CardContent className="p-4">
                    <div className="flex flex-col xl:flex-row gap-6 items-end">

                        {/* Common Params */}
                        <div className="flex flex-wrap gap-4 flex-1">
                            <div className="space-y-1 w-32">
                                <Label className="text-xs text-muted-foreground">Expense</Label>
                                <Input type="number" value={localExpense} onChange={(e) => setLocalExpense(Number(e.target.value))} className="h-9" />
                            </div>
                            <div className="space-y-1 w-20">
                                <Label className="text-xs text-muted-foreground">Inflation</Label>
                                <Input type="number" step="0.1" value={localInflation} onChange={(e) => setLocalInflation(Number(e.target.value))} className="h-9" />
                            </div>
                            <div className="space-y-1 w-20">
                                <Label className="text-xs text-muted-foreground">Years</Label>
                                <Input type="number" value={localYears} onChange={(e) => setLocalYears(Number(e.target.value))} className="h-9" />
                            </div>
                        </div>

                        <div className="w-px h-10 bg-slate-200 dark:bg-slate-800 hidden xl:block" />

                        {/* Mode Strategy */}
                        <div className="flex flex-wrap items-end gap-4 flex-1">
                            <div className="flex flex-col gap-1">
                                <Label className="text-xs text-muted-foreground">Optimization Goal</Label>
                                <Tabs value={optimizationMode} onValueChange={(v) => setOptimizationMode(v as 'find-optimal' | 'fixed-isr')} className="w-[300px]">
                                    <TabsList className="w-full">
                                        <TabsTrigger value="find-optimal" className="flex-1">Find Optimal ISR</TabsTrigger>
                                        <TabsTrigger value="fixed-isr" className="flex-1">Fixed ISR</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>

                            {optimizationMode === 'fixed-isr' && (
                                <div className="space-y-1 w-24 animate-in fade-in slide-in-from-left-4">
                                    <Label className="text-xs text-muted-foreground text-primary font-bold">Target ISR</Label>
                                    <Input
                                        type="number"
                                        value={fixedIsr}
                                        onChange={(e) => setFixedIsr(Number(e.target.value))}
                                        className="h-9 border-primary/50 text-primary font-bold"
                                    />
                                </div>
                            )}

                            <Button onClick={handleOptimize} className="h-9 xl:ml-auto min-w-[120px]">
                                <RefreshCw className="w-4 h-4 mr-2" />
                                {optimizationMode === 'find-optimal' ? 'Run Optimize' : 'Run Analysis'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Results Section */}
            {
                isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
                        <p className="text-lg font-medium">Running High-Precision Analysis...</p>
                        <p className="text-sm text-muted-foreground">Simulating 15,000+ scenarios with your custom parameters</p>
                    </div>
                ) : results && results.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 flex-1">
                        {/* Left: Best Strategy */}
                        <div className="lg:col-span-12 xl:col-span-5 flex flex-col space-y-6">
                            <Card className="flex-1 flex flex-col justify-center border-2 border-primary/10 shadow-2xl bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
                                <CardHeader className="text-center pb-2">
                                    <div className="mx-auto bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase mb-4 w-fit">
                                        Top Recommendation
                                    </div>
                                    <CardTitle className="text-2xl font-bold text-primary">
                                        {results[0].allocationName}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col items-center justify-center space-y-8 py-8">
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
                                            {optimizationMode === 'find-optimal' ? 'Required ISR' : 'Fixed ISR'}
                                        </p>
                                        <p className="text-6xl font-extrabold text-slate-800 dark:text-slate-100">{results[0].isr}<span className="text-2xl text-slate-400 font-bold">x</span></p>
                                        <p className="text-sm text-muted-foreground mt-2">Years of Expenses ({formatINR(localExpense * 12 * results[0].isr)})</p>
                                    </div>

                                    <div className="w-full max-w-xs space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span>Success Probability</span>
                                            <span className={`font-bold ${results[0].successRate > 90 ? 'text-green-600' : 'text-orange-600'}`}>
                                                {results[0].successRate.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${results[0].successRate > 90 ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${results[0].successRate}%` }} />
                                        </div>
                                    </div>

                                    <Button size="lg" className="w-full max-w-xs text-lg" onClick={() => onApplyStrategy(results[0].isr, results[0].allocation, applyParams)}>
                                        Apply Strategy <ArrowRight className="ml-2 h-5 w-5" />
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right: Comparative List */}
                        <div className="lg:col-span-12 xl:col-span-7 space-y-4">
                            <Card className="h-full border shadow-sm flex flex-col">
                                <CardHeader className="pb-4">
                                    <CardTitle>Strategy Comparison</CardTitle>
                                    <CardDescription>
                                        {optimizationMode === 'find-optimal'
                                            ? "Comparison of Minimum ISR needed for >90% success"
                                            : `Performance of all strategies at ${fixedIsr}x expenses`
                                        }
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto pr-2 space-y-6">
                                    {/* Legend */}
                                    <div className="flex items-center gap-6 text-xs text-muted-foreground ml-1">
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /> Stable</div>
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-500" /> Conservative</div>
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500" /> Growth</div>
                                    </div>

                                    <div className="space-y-3">
                                        {results.map((strategy, i) => (
                                            <div
                                                key={i}
                                                className={`group relative p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${i === 0 ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/10' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-primary/20'}`}
                                                onClick={() => onApplyStrategy(strategy.isr, strategy.allocation, applyParams, bucketOverrides, strategyType)}
                                            >
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                                                    {/* Info & Allocation */}
                                                    <div className="space-y-2 flex-1 min-w-[180px]">
                                                        <div className="flex items-center justify-between">
                                                            <span className={`font-semibold ${i === 0 ? 'text-primary' : ''}`}>
                                                                {strategy.allocationName.split('(')[0]}
                                                                {i === 0 && <span className="ml-2 text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">Best</span>}
                                                            </span>
                                                        </div>
                                                        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden">
                                                            <div className="h-full bg-blue-500" style={{ width: `${strategy.allocation[0] * 100}%` }} />
                                                            <div className="h-full bg-indigo-500" style={{ width: `${strategy.allocation[1] * 100}%` }} />
                                                            <div className="h-full bg-purple-500" style={{ width: `${strategy.allocation[2] * 100}%` }} />
                                                        </div>
                                                        <div className="flex text-[10px] text-muted-foreground gap-2">
                                                            <span>{Math.round(strategy.allocation[0] * 100)}%</span>
                                                            <span className="flex-1 text-center">{Math.round(strategy.allocation[1] * 100)}%</span>
                                                            <span className="text-right">{Math.round(strategy.allocation[2] * 100)}%</span>
                                                        </div>
                                                    </div>

                                                    {/* Metrics */}
                                                    <div className="flex items-center gap-6 sm:justify-end min-w-[200px]">
                                                        <div className="text-center w-16">
                                                            <p className="text-[10px] text-muted-foreground uppercase">Funds</p>
                                                            <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{strategy.isr}x</p>
                                                        </div>
                                                        <div className="text-center w-16">
                                                            <p className="text-[10px] text-muted-foreground uppercase">Success</p>
                                                            <p className={`text-lg font-bold ${strategy.successRate >= 90 ? 'text-green-600' : 'text-orange-600'}`}>
                                                                {strategy.successRate.toFixed(1)}%
                                                            </p>
                                                        </div>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <ArrowRight className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                        <div className="p-6 bg-orange-50 dark:bg-orange-950/20 rounded-xl border border-orange-200">
                            <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-400 mb-2">No Optimized Strategy Found</h3>
                            <p className="text-sm mb-4">Current parameters might be too aggressive. Try reducing expense or inflation.</p>
                            <Button onClick={handleOptimize} variant="outline" size="sm">
                                <RefreshCw className="w-4 h-4 mr-2" /> Re-Try Optimization
                            </Button>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
