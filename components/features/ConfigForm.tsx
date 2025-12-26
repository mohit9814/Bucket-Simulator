"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FIRE_MODES } from "@/lib/constants";
import { calculateRequiredFunds } from "@/lib/simulation";
import { FireMode, StrategyType } from "@/types";
import { Calculator, Play, Sparkles, Settings2, LayoutTemplate, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { cn, formatINR } from "@/lib/utils";
import { OptimizerResults } from "./OptimizerResults";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BUCKETS } from "@/lib/constants";

interface ConfigFormProps {
    onRunSimulation: (
        expense: number,
        mode: FireMode,
        years: number,
        inflation: number,
        numSimulations: number,
        isr: number,
        bucketAllocations: [number, number, number],
        startAge: number,
        taxEnabled: boolean,
        isJoint: boolean,
        annualRebalancing: boolean,
        strategyType: StrategyType,

        bucketConfigOverride?: { [key: number]: { returnRate: number, volatility: number } },
        equityFreezeYears?: number
    ) => void;
    initialValues?: {
        expense: number;
        mode: FireMode;
        years: number;
        inflation: number;
        isr: number;
        bucketAllocations: [number, number, number];
        startAge?: number;
        taxEnabled?: boolean;
        isJoint?: boolean;
        annualRebalancing?: boolean;
        strategyType: StrategyType;
        bucketConfigOverride?: { [key: number]: { returnRate: number, volatility: number } };
        equityFreezeYears?: number;
    } | null;
}

export function ConfigForm({ onRunSimulation, initialValues }: ConfigFormProps) {
    const [expense, setExpense] = useState<number>(100000);
    const [mode, setMode] = useState<FireMode>("Custom");
    const [currentAge, setCurrentAge] = useState<number>(44);
    const [retirementAge, setRetirementAge] = useState<number>(44);
    const [lifeExpectancy, setLifeExpectancy] = useState<number>(85);
    const [inflation, setInflation] = useState<number>(7);
    const [numSimulations, setNumSimulations] = useState<number>(1000);

    // Advanced / Custom Params
    const [isr, setIsr] = useState<number>(37);
    const [bucketAllocations, setBucketAllocations] = useState<[number, number, number]>([0.15, 0.50, 0.35]);
    const [bucketOverrides, setBucketOverrides] = useState<{ [key: number]: { returnRate: number, volatility: number } } | undefined>(undefined);

    const [showOptimizer, setShowOptimizer] = useState(false);
    const [taxEnabled, setTaxEnabled] = useState<boolean>(true);
    const [isJoint, setIsJoint] = useState<boolean>(true);
    const [annualRebalancing, setAnnualRebalancing] = useState<boolean>(false);
    const [strategyType, setStrategyType] = useState<StrategyType>('three-bucket');
    const [equityFreezeYears, setEquityFreezeYears] = useState<number>(10);

    const [requiredCorpus, setRequiredCorpus] = useState<number>(0);

    // Sync state with initialValues if provided (e.g. from Share URL)
    useEffect(() => {
        if (initialValues) {
            setExpense(initialValues.expense);
            setMode(initialValues.mode);
            setInflation(initialValues.inflation);
            setIsr(initialValues.isr);
            setBucketAllocations(initialValues.bucketAllocations);
            setTaxEnabled(initialValues.taxEnabled ?? true);
            setIsJoint(initialValues.isJoint ?? true);
            setAnnualRebalancing(initialValues.annualRebalancing ?? false);
            setStrategyType(initialValues.strategyType);
            setEquityFreezeYears(initialValues.equityFreezeYears ?? 10);
            if (initialValues.bucketConfigOverride) {
                setBucketOverrides(initialValues.bucketConfigOverride);
            }

            if (initialValues.startAge) {
                setRetirementAge(initialValues.startAge);
                // We derive life expectancy from years + startAge
                setLifeExpectancy(initialValues.startAge + initialValues.years);
            }
        }
    }, [initialValues]);

    // Sync ISR on Mode Change (uni-directional)
    useEffect(() => {
        // Only override ISR if mode changed by USER interaction (checking if it matches current ISR can avoid loops, 
        // but here we just check if mode is custom. 
        // If initialValues sets 'Custom' and a specific ISR, this effect might overwrite it if we aren't careful.
        // However, standard modes have fixed ISRs. Custom mode doesn't trigger this.)
        if (mode !== 'Custom') {
            setIsr(FIRE_MODES[mode].isr);
        }
    }, [mode]);

    useEffect(() => {
        setRequiredCorpus(calculateRequiredFunds(expense, isr));
    }, [expense, isr]);

    // Bucket Override Logic
    const [editingBucketId, setEditingBucketId] = useState<number | null>(null);
    const [tempOverride, setTempOverride] = useState({ returnRate: 0, volatility: 0 });

    const handleBucketClick = (bucketId: number) => {
        const defaultBucket = BUCKETS.find(b => b.id === bucketId);
        if (!defaultBucket) return;

        const currentOverride = bucketOverrides?.[bucketId];
        setTempOverride({
            returnRate: (currentOverride?.returnRate ?? defaultBucket.returnRate) * 100,
            volatility: (currentOverride?.volatility ?? defaultBucket.volatility) * 100
        });
        setEditingBucketId(bucketId);
    };

    const handleSaveOverride = () => {
        if (editingBucketId === null) return;
        setBucketOverrides(prev => ({
            ...prev,
            [editingBucketId]: {
                returnRate: tempOverride.returnRate / 100,
                volatility: tempOverride.volatility / 100
            }
        }));
        setEditingBucketId(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const duration = lifeExpectancy - retirementAge;
        onRunSimulation(expense, mode, duration, inflation, numSimulations, isr, bucketAllocations, retirementAge, taxEnabled, isJoint, annualRebalancing, strategyType, bucketOverrides, equityFreezeYears);
    };

    const handleApplyStrategy = (
        newIsr: number,
        newAllocation: [number, number, number],
        updatedParams?: { expense: number, inflation: number, years: number },
        overrides?: { [key: number]: { returnRate: number, volatility: number } },
        newStrategyType?: StrategyType,

        newEquityFreezeYears?: number
    ) => {
        // Update Form State
        setMode('Custom');
        setIsr(newIsr);
        setBucketAllocations(newAllocation);
        if (newStrategyType) setStrategyType(newStrategyType);
        if (newEquityFreezeYears !== undefined) setEquityFreezeYears(newEquityFreezeYears);
        if (overrides) {
            setBucketOverrides(overrides);
        }

        let currentExpense = expense;
        let currentInflation = inflation;
        let duration = lifeExpectancy - retirementAge;

        if (updatedParams) {
            setExpense(updatedParams.expense);
            setInflation(updatedParams.inflation);
            // Update life expectancy based on new duration
            const newLifeExpectancy = retirementAge + updatedParams.years;
            setLifeExpectancy(newLifeExpectancy);

            currentExpense = updatedParams.expense;
            currentInflation = updatedParams.inflation;
            duration = updatedParams.years;
        }

        setShowOptimizer(false);

        // Auto-run simulation
        onRunSimulation(
            currentExpense,
            'Custom',
            duration,
            currentInflation,
            numSimulations,
            newIsr,
            newAllocation,
            retirementAge,
            taxEnabled,
            isJoint,
            annualRebalancing,
            newStrategyType || strategyType,

            overrides || bucketOverrides,
            newEquityFreezeYears !== undefined ? newEquityFreezeYears : equityFreezeYears
        );
    };

    return (
        <Card className="glass-card w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-primary" />
                    Configuration
                </CardTitle>
                <CardDescription>Setup your retirement parameters</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Strategy Overview - Interactive */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2 text-primary font-semibold">
                                <Settings2 className="w-4 h-4" />
                                Strategy Overview
                            </Label>
                            <span className="text-[10px] text-muted-foreground">(Click to Edit)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {BUCKETS.filter((_, idx) => bucketAllocations[idx] > 0).map((bucket) => {
                                const override = bucketOverrides?.[bucket.id];
                                const effectiveRate = override?.returnRate ?? bucket.returnRate;
                                const effectiveVol = override?.volatility ?? bucket.volatility;
                                const isModified = !!override;

                                return (
                                    <div
                                        key={bucket.id}
                                        onClick={() => handleBucketClick(bucket.id)}
                                        className={cn(
                                            "relative p-4 rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-primary/50 group",
                                            isModified && "border-indigo-500/50 bg-indigo-50/10"
                                        )}
                                    >
                                        <div className="text-center space-y-1">
                                            <div className={cn(
                                                "text-2xl font-bold",
                                                bucket.id === 1 ? "text-emerald-600" : bucket.id === 2 ? "text-amber-600" : "text-indigo-600"
                                            )}>
                                                {(effectiveRate * 100).toFixed(1)}%
                                            </div>
                                            <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground group-hover:text-primary transition-colors">
                                                {bucket.name}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground opacity-70">
                                                Vol: {(effectiveVol * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                        {isModified && (
                                            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="currentAge">Current Age</Label>
                            <Input
                                id="currentAge"
                                type="number"
                                min={18}
                                max={100}
                                value={currentAge}
                                onChange={(e) => setCurrentAge(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="retirementAge">Retirement Age</Label>
                            <Input
                                id="retirementAge"
                                type="number"
                                min={currentAge}
                                max={100}
                                value={retirementAge}
                                onChange={(e) => setRetirementAge(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="lifeExpectancy">Life Expectancy</Label>
                        <Input
                            id="lifeExpectancy"
                            type="number"
                            min={retirementAge}
                            max={120}
                            value={lifeExpectancy}
                            onChange={(e) => setLifeExpectancy(Number(e.target.value))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="expense">Monthly Expense (Post-Retirement)</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                            <Input
                                id="expense"
                                type="number"
                                min={1000}
                                step={500}
                                className="pl-7"
                                value={expense}
                                onChange={(e) => setExpense(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    {/* Strategy Type & Freeze */}
                    <div className="space-y-4 border p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border-dashed">
                        {/* Strategy Type Selection Removed - Defaulting to 3-Bucket */}

                        <div className="grid gap-1.5 leading-none">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="equityFreeze" className="text-xs font-medium">Freeze Equity Withdrawals (Years)</Label>
                                <Input
                                    id="equityFreeze"
                                    type="number"
                                    min={0}
                                    max={30}
                                    value={equityFreezeYears}
                                    onChange={(e) => setEquityFreezeYears(Number(e.target.value))}
                                    className="h-7 w-16 text-right"
                                />
                            </div>
                            <p className="text-[0.8rem] text-muted-foreground">
                                Prevent transfers from Growth Bucket for the first X years (Sequence of Return Risk mitigation).
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col space-y-2">
                        <div className="flex items-center space-x-2 border p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border-dashed">
                            <input
                                type="checkbox"
                                id="taxEnabled"
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={taxEnabled}
                                onChange={(e) => setTaxEnabled(e.target.checked)}
                            />
                            <div className="grid gap-1.5 leading-none">
                                <label
                                    htmlFor="taxEnabled"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Enable Income Tax (New Regime)
                                </label>
                                <p className="text-[0.8rem] text-muted-foreground">
                                    Annual tax deduction from buckets.
                                </p>
                            </div>
                        </div>

                        {taxEnabled && (
                            <div className="flex items-center space-x-2 border p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border-dashed ml-4">
                                <input
                                    type="checkbox"
                                    id="isJoint"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={isJoint}
                                    onChange={(e) => setIsJoint(e.target.checked)}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <label
                                        htmlFor="isJoint"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        Joint Assessment (Spouse)
                                    </label>
                                    <p className="text-[0.8rem] text-muted-foreground">
                                        Splits income 50/50. Doubles ₹1.25L LTCG Exemption.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center space-x-2 border p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border-dashed">
                        <input
                            type="checkbox"
                            id="annualRebalancing"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={annualRebalancing}
                            onChange={(e) => setAnnualRebalancing(e.target.checked)}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label
                                htmlFor="annualRebalancing"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Annual Rebalancing
                            </label>
                            <p className="text-[0.8rem] text-muted-foreground">
                                Reset buckets to target allocation % every year.
                            </p>
                        </div>
                    </div>



                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label>FIRE Mode</Label>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {(Object.keys(FIRE_MODES) as FireMode[]).map((m) => {
                                const config = FIRE_MODES[m];
                                const isSelected = mode === m;
                                const isCustom = m === 'Custom';
                                return (
                                    <div
                                        key={m}
                                        onClick={() => setMode(m)}
                                        className={cn(
                                            "cursor-pointer rounded-lg border p-3 transition-all hover:bg-accent relative",
                                            isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card"
                                        )}
                                    >
                                        <div className="text-sm font-semibold">{config.label}</div>
                                        {isCustom && isSelected ? (
                                            <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                                                <Input
                                                    type="number"
                                                    value={isr}
                                                    onChange={(e) => setIsr(Number(e.target.value))}
                                                    className="h-6 text-xs p-1 w-full bg-white dark:bg-slate-800"
                                                />
                                                <span className="text-xs text-muted-foreground">x</span>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-muted-foreground mt-1">{isCustom ? `${isr}x` : `${config.isr}x`}</div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Custom Allocation Inputs */}
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-dashed">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Bucket 1 (Cash)</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        className="h-8 font-mono text-center"
                                        value={Math.round(bucketAllocations[0] * 10000) / 100}
                                        onChange={(e) => {
                                            const val = Number(e.target.value) / 100;
                                            const rem = 1 - val;
                                            setBucketAllocations([val, rem / 2, rem / 2]);
                                            setMode('Custom');
                                        }}
                                    />
                                    <span className="text-xs text-muted-foreground">%</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                    Bucket 2 (Conservative)
                                </Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        className="h-8 font-mono text-center"
                                        value={Math.round(bucketAllocations[1] * 10000) / 100}
                                        onChange={(e) => {
                                            const val = Number(e.target.value) / 100;
                                            const b1 = bucketAllocations[0];
                                            const b3 = 1 - b1 - val;
                                            setBucketAllocations([b1, val, b3]);
                                            setMode('Custom');
                                        }}
                                    />
                                    <span className="text-xs text-muted-foreground">%</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Bucket 3 (Growth)</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        className="h-8 font-mono text-center"
                                        value={Math.round(bucketAllocations[2] * 10000) / 100}
                                        onChange={(e) => {
                                            const val = Number(e.target.value) / 100;
                                            const b1 = bucketAllocations[0];
                                            const b2 = 1 - b1 - val;
                                            setBucketAllocations([b1, b2, val]);
                                            setMode('Custom');
                                        }}
                                    />
                                    <span className="text-xs text-muted-foreground">%</span>
                                </div>
                            </div>
                        </div>

                        {mode === 'Custom' && bucketOverrides && (
                            <div className="mt-2 text-xs text-center text-primary font-medium">
                                Custom Advanced Overrides Active
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg bg-secondary/50 p-4">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium">Required Corpus</span>
                            <span className="text-lg font-bold text-primary">{formatINR(requiredCorpus)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {mode === 'Custom' ? 'Based on Custom optimization' : `Based on ${FIRE_MODES[mode].label} multiplier`}
                        </p>
                    </div>

                    <Button type="submit" size="lg" className="w-full font-semibold shadow-lg shadow-primary/20">
                        <Play className="w-4 h-4 mr-2" />
                        Run Simulation ({lifeExpectancy - retirementAge} Years)
                    </Button>
                </form>

                {/* Edit Bucket Dialog */}
                <Dialog open={editingBucketId !== null} onOpenChange={(open) => !open && setEditingBucketId(null)}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Edit Bucket Parameters</DialogTitle>
                            <CardDescription>
                                Override the default return and volatility for {BUCKETS.find(b => b.id === editingBucketId)?.name}.
                            </CardDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="returnRate" className="text-right">
                                    Return
                                </Label>
                                <div className="col-span-3 relative">
                                    <Input
                                        id="returnRate"
                                        type="number"
                                        step="0.1"
                                        value={tempOverride.returnRate}
                                        onChange={(e) => setTempOverride(prev => ({ ...prev, returnRate: Number(e.target.value) }))}
                                        className="pr-8"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="volatility" className="text-right">
                                    Volatility
                                </Label>
                                <div className="col-span-3 relative">
                                    <Input
                                        id="volatility"
                                        type="number"
                                        step="0.1"
                                        value={tempOverride.volatility}
                                        onChange={(e) => setTempOverride(prev => ({ ...prev, volatility: Number(e.target.value) }))}
                                        className="pr-8"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md text-xs text-yellow-800 dark:text-yellow-200 mb-4">
                            Note: Changing these values will override the default assumptions for this bucket in the simulation.
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingBucketId(null)}>Cancel</Button>
                            <Button onClick={handleSaveOverride}>Save Changes</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card >
    );
}
