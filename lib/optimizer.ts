import { runSimulation } from "./simulation";
import { SimulationParams, StrategyType } from "@/types";

export interface OptimizationResult {
    isr: number;
    allocation: [number, number, number];
    successRate: number;
    totalFundsRequired: number;
    allocationName: string;
}

export const ALLOCATION_PRESETS: { name: string; allocation: [number, number, number] }[] = [
    { name: "Conservative (60/30/10)", allocation: [0.60, 0.30, 0.10] },
    { name: "Balanced (33/33/33)", allocation: [0.3333, 0.3333, 0.3334] },
    { name: "Growth (10/30/60)", allocation: [0.10, 0.30, 0.60] },
    { name: "Aggressive (0/20/80)", allocation: [0.0, 0.20, 0.80] },
    { name: "Ultra Safe (80/20/0)", allocation: [0.80, 0.20, 0.0] },
    { name: "Barbell (40/10/50)", allocation: [0.40, 0.10, 0.50] },
];

export const TWO_BUCKET_PRESETS: { name: string; allocation: [number, number, number] }[] = [
    { name: "Safe (80/20)", allocation: [0.80, 0.20, 0.0] },
    { name: "Conservative (60/40)", allocation: [0.60, 0.40, 0.0] },
    { name: "Balanced (50/50)", allocation: [0.50, 0.50, 0.0] },
    { name: "Growth (40/60)", allocation: [0.40, 0.60, 0.0] },
    { name: "Aggressive (20/80)", allocation: [0.20, 0.80, 0.0] },
    { name: "Equity Heavy (10/90)", allocation: [0.10, 0.90, 0.0] },
];

export async function findOptimalStrategy(
    monthlyExpense: number,
    inflationRate: number,
    years: number,
    existingCorpus?: number, // Unused logic kept for compat
    bucketConfigOverride?: { [key: number]: { returnRate: number, volatility: number } },
    annualRebalancing?: boolean,
    strategyType: StrategyType = 'three-bucket'
): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];
    const PRESETS = strategyType === 'three-bucket' ? ALLOCATION_PRESETS : TWO_BUCKET_PRESETS;

    // ISR Search Range: 15 to 60 years of expenses
    // We want the lowest ISR that gives > 90% success.

    // Strategy:
    // Iterate through ISRs from 20 to 50.
    // For each ISR, test all Allocations.
    // Return all valid configurations that have > 90% success.

    // To prevent freezing interaction, this should ideally be yielded or run in chunks, 
    // but for now we'll run it synchronously but with lower sim count for speed.

    // Higher sample size for better statistical significance
    const SEARCH_SIM_COUNT = 500;
    const VERIFY_SIM_COUNT = 2000;
    const TARGET_SUCCESS = 85;

    // Use Promise.all to run strategies "concurrently" (allowing UI breathing room via setImmediate/setTimeout)
    const promises = PRESETS.map(async (preset) => {
        // Yield to event loop to prevent UI freezing
        await new Promise(resolve => setTimeout(resolve, 0));

        let low = 15;
        let high = 60;
        let optimalIsrForThisAlloc = -1;

        // Binary Search for optimal ISR
        while (low <= high) {
            const midIsr = Math.floor((low + high) / 2);
            const totalFunds = monthlyExpense * 12 * midIsr;

            const simResult = runSimulation({
                totalFunds,
                monthlyExpense,
                years,
                inflationRate,
                bucketAllocations: preset.allocation,
                numSimulations: SEARCH_SIM_COUNT,
                bucketConfigOverride,
                annualRebalancing,
                strategyType
            });

            if (simResult.successRate >= TARGET_SUCCESS) {
                optimalIsrForThisAlloc = midIsr;
                high = midIsr - 1; // Try to find a lower (cheaper) ISR
            } else {
                low = midIsr + 1; // Need more buffer
            }
        }

        if (optimalIsrForThisAlloc !== -1) {
            // Verification Run with high sample size
            // Yield again before heavy lifting
            await new Promise(resolve => setTimeout(resolve, 0));

            const verifyResult = runSimulation({
                totalFunds: monthlyExpense * 12 * optimalIsrForThisAlloc,
                monthlyExpense,
                years,
                inflationRate,
                bucketAllocations: preset.allocation,
                numSimulations: VERIFY_SIM_COUNT,
                bucketConfigOverride,
                annualRebalancing,
                strategyType
            });

            // Tolerance check: Even if it dips slightly below target (e.g. -0.5%) in the large run, 
            // we might still accept it.
            if (verifyResult.successRate >= TARGET_SUCCESS - 0.5) {
                results.push({
                    isr: optimalIsrForThisAlloc,
                    allocation: preset.allocation,
                    successRate: verifyResult.successRate,
                    totalFundsRequired: monthlyExpense * 12 * optimalIsrForThisAlloc,
                    allocationName: preset.name
                });
            }
        }
    });

    await Promise.all(promises);

    // Sort by lowest ISR (cheapest strategy first), then by success rate
    return results.sort((a, b) => {
        if (a.isr === b.isr) return b.successRate - a.successRate;
        return a.isr - b.isr;
    });
}

// New Analyzer for Fixed ISR
export async function analyzeFixedIsrStrategies(
    monthlyExpense: number,
    inflationRate: number,
    years: number,
    targetIsr: number,
    bucketConfigOverride?: { [key: number]: { returnRate: number, volatility: number } },
    annualRebalancing?: boolean,
    strategyType: StrategyType = 'three-bucket'
): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];
    const SIM_COUNT = 2000;
    const PRESETS = strategyType === 'three-bucket' ? ALLOCATION_PRESETS : TWO_BUCKET_PRESETS;

    const totalFunds = monthlyExpense * 12 * targetIsr;

    const promises = PRESETS.map(async (preset) => {
        await new Promise(resolve => setTimeout(resolve, 0));

        const simResult = runSimulation({
            totalFunds,
            monthlyExpense,
            years,
            inflationRate,
            bucketAllocations: preset.allocation,
            numSimulations: SIM_COUNT,
            bucketConfigOverride,
            annualRebalancing,
            strategyType
        });

        results.push({
            isr: targetIsr,
            allocation: preset.allocation,
            successRate: simResult.successRate,
            totalFundsRequired: totalFunds,
            allocationName: preset.name
        });
    });

    await Promise.all(promises);

    // Sort by success rate descending (best first)
    return results.sort((a, b) => b.successRate - a.successRate);
}
