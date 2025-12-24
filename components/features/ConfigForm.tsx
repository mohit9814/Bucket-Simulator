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
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

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
        bucketConfigOverride?: { [key: number]: { returnRate: number, volatility: number } }
    ) => void;
}

export function ConfigForm({ onRunSimulation }: ConfigFormProps) {
    const [expense, setExpense] = useState<number>(50000);
    const [mode, setMode] = useState<FireMode>("Chubby");
    const [currentAge, setCurrentAge] = useState<number>(44);
    const [retirementAge, setRetirementAge] = useState<number>(44);
    const [lifeExpectancy, setLifeExpectancy] = useState<number>(85);
    const [inflation, setInflation] = useState<number>(7);
    const [numSimulations, setNumSimulations] = useState<number>(1000);

    // Advanced / Custom Params
    const [isr, setIsr] = useState<number>(24);
    const [bucketAllocations, setBucketAllocations] = useState<[number, number, number]>([0.3333, 0.3333, 0.3334]);
    const [bucketOverrides, setBucketOverrides] = useState<{ [key: number]: { returnRate: number, volatility: number } } | undefined>(undefined);

    const [showOptimizer, setShowOptimizer] = useState(false);
    const [taxEnabled, setTaxEnabled] = useState<boolean>(true);
    const [isJoint, setIsJoint] = useState<boolean>(false);
    const [annualRebalancing, setAnnualRebalancing] = useState<boolean>(false);
    const [strategyType, setStrategyType] = useState<StrategyType>('three-bucket');

    const [requiredCorpus, setRequiredCorpus] = useState<number>(0);

    // Sync ISR on Mode Change (uni-directional)
    useEffect(() => {
        if (mode !== 'Custom') {
            setIsr(FIRE_MODES[mode].isr);
        }
    }, [mode]);

    useEffect(() => {
        setRequiredCorpus(calculateRequiredFunds(expense, isr));
    }, [expense, isr]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const duration = lifeExpectancy - retirementAge;
        onRunSimulation(expense, mode, duration, inflation, numSimulations, isr, bucketAllocations, retirementAge, taxEnabled, isJoint, annualRebalancing, strategyType, bucketOverrides);
    };

    const handleApplyStrategy = (
        newIsr: number,
        newAllocation: [number, number, number],
        updatedParams?: { expense: number, inflation: number, years: number },
        overrides?: { [key: number]: { returnRate: number, volatility: number } },
        newStrategyType?: StrategyType
    ) => {
        // Update Form State
        setMode('Custom');
        setIsr(newIsr);
        setBucketAllocations(newAllocation);
        if (newStrategyType) setStrategyType(newStrategyType);
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
            overrides || bucketOverrides
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

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="inflation">Inflation Rate (%)</Label>
                            <Dialog open={showOptimizer} onOpenChange={setShowOptimizer}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 text-xs text-indigo-600 hover:text-indigo-700">
                                        <Sparkles className="w-3 h-3 mr-1" />
                                        Optimize
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="w-screen h-screen max-w-none rounded-none border-0 flex flex-col justify-center overflow-y-auto bg-background/95 backdrop-blur-xl">
                                    <OptimizerResults
                                        monthlyExpense={expense}
                                        inflationRate={inflation}
                                        years={lifeExpectancy - retirementAge}
                                        strategyType={strategyType}
                                        onApplyStrategy={handleApplyStrategy}
                                    />
                                </DialogContent>
                            </Dialog>
                        </div>
                        <Input
                            id="inflation"
                            type="number"
                            min={0}
                            max={20}
                            step={0.1}
                            value={inflation}
                            onChange={(e) => setInflation(Number(e.target.value))}
                        />
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

                    <div className="flex items-center space-x-2 border p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border-dashed">
                        <div className="grid gap-1.5 leading-none w-full">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2">
                                    {strategyType === 'three-bucket' ? <Layers className="w-4 h-4" /> : <LayoutTemplate className="w-4 h-4" />}
                                    Strategy Type
                                </Label>
                            </div>
                            <div className="flex gap-2 bg-slate-200 dark:bg-slate-800 p-1 rounded-md overflow-x-auto">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStrategyType('three-bucket');
                                        setBucketAllocations([0.3333, 0.3333, 0.3334]);
                                    }}
                                    className={cn(
                                        "px-2 py-1 text-xs rounded-sm transition-all whitespace-nowrap",
                                        strategyType === 'three-bucket' ? "bg-white dark:bg-slate-600 shadow-sm font-semibold" : "text-muted-foreground hover:bg-white/50"
                                    )}
                                >
                                    3-Bucket
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStrategyType('two-bucket');
                                        setBucketAllocations([0.2, 0.8, 0.0]);
                                    }}
                                    className={cn(
                                        "px-2 py-1 text-xs rounded-sm transition-all whitespace-nowrap",
                                        strategyType === 'two-bucket' ? "bg-white dark:bg-slate-600 shadow-sm font-semibold" : "text-muted-foreground hover:bg-white/50"
                                    )}
                                >
                                    2-Bucket
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStrategyType('dynamic-aggressive');
                                        // Allocations will be overridden by simulation, but set reasonable defaults for UI
                                        setBucketAllocations([0.15, 0.25, 0.60]);
                                    }}
                                    className={cn(
                                        "px-2 py-1 text-xs rounded-sm transition-all whitespace-nowrap",
                                        strategyType === 'dynamic-aggressive' ? "bg-white dark:bg-slate-600 shadow-sm font-semibold text-indigo-600" : "text-muted-foreground hover:bg-white/50"
                                    )}
                                >
                                    Dynamic Aggressive
                                </button>
                            </div>
                            <p className="text-[0.8rem] text-muted-foreground mt-1">
                                {strategyType === 'three-bucket'
                                    ? "Standard model with Cash, Debt/Conservative, and Equity buckets."
                                    : strategyType === 'two-bucket'
                                        ? "Simplified model with Liquid Cash and Growth Equity only."
                                        : "Maintains 4 years in B1, 6 years in B2, rest in Equity. Rebalances annually."}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label>FIRE Mode</Label>
                            <Label>FIRE Mode / ISR (Years)</Label>
                            <div className="w-20">
                                <Input
                                    type="number"
                                    className="h-6 text-xs"
                                    value={isr}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setIsr(val);
                                        setMode('Custom');
                                    }}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            {(Object.keys(FIRE_MODES) as FireMode[]).filter(m => m !== 'Custom').map((m) => {
                                const config = FIRE_MODES[m];
                                const isSelected = mode === m;
                                return (
                                    <div
                                        key={m}
                                        onClick={() => setMode(m)}
                                        className={cn(
                                            "cursor-pointer rounded-lg border p-3 transition-all hover:bg-accent",
                                            isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card"
                                        )}
                                    >
                                        <div className="text-sm font-semibold">{config.label}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{config.isr}x</div>
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
                                            if (strategyType === 'three-bucket') {
                                                setBucketAllocations([val, rem / 2, rem / 2]);
                                            } else {
                                                setBucketAllocations([val, rem, 0]);
                                            }
                                            setMode('Custom');
                                        }}
                                    />
                                    <span className="text-xs text-muted-foreground">%</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                    {strategyType === 'three-bucket' ? 'Bucket 2 (Conservative)' : 'Bucket 2 (Growth)'}
                                </Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        className="h-8 font-mono text-center"
                                        value={Math.round(bucketAllocations[1] * 10000) / 100}
                                        onChange={(e) => {
                                            const val = Number(e.target.value) / 100;
                                            if (strategyType === 'three-bucket') {
                                                const b1 = bucketAllocations[0];
                                                const b3 = 1 - b1 - val;
                                                setBucketAllocations([b1, val, b3]);
                                            } else {
                                                const rem = 1 - val;
                                                setBucketAllocations([rem, val, 0]);
                                            }
                                            setMode('Custom');
                                        }}
                                    />
                                    <span className="text-xs text-muted-foreground">%</span>
                                </div>
                            </div>
                            {strategyType === 'three-bucket' && (
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
                            )}
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
                </form >
            </CardContent >
        </Card >
    );
}
