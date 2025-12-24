import { BucketState, MonthSimulation, SimulationResult, SimulationParams } from "@/types";
import { BUCKETS } from "./constants";
import { boxMullerTransform } from "./math";
import { calculateTaxNewRegime, calculateLTCG } from "./tax";

export function calculateRequiredFunds(monthlyExpense: number, isr: number): number {
    return monthlyExpense * 12 * isr;
}



// Internal single simulation run
function runSingleSimulation(params: SimulationParams & { inflationRate?: number }): SimulationResult {
    const {
        totalFunds,
        monthlyExpense,
        years = 30,
        inflationRate = 7,
        bucketAllocations = [0.3333, 0.3333, 0.3334],
        bucketConfigOverride,
        startAge = 40,
        taxEnabled = false,
        isJoint = false,
        annualRebalancing = false,
        strategyType = 'three-bucket'
    } = params;

    const months = years * 12;
    const history: MonthSimulation[] = [];

    // Helper to get bucket config (with override support)
    const getBucketConfig = (id: number) => {
        const defaultCfg = BUCKETS.find(b => b.id === id)!;
        if (bucketConfigOverride && bucketConfigOverride[id]) {
            return { ...defaultCfg, ...bucketConfigOverride[id] };
        }
        return defaultCfg;
    };

    // Initialize buckets based on allocation
    // Normalize allocations just in case
    const totalAlloc = bucketAllocations.reduce((sum, val) => sum + val, 0);
    const normalizedAllocations = bucketAllocations.map(val => val / totalAlloc);

    let b1 = totalFunds * normalizedAllocations[0];
    let b2 = totalFunds * normalizedAllocations[1];
    let b3 = totalFunds * normalizedAllocations[2];

    // Initial Override for Dynamic Aggressive
    if (strategyType === 'dynamic-aggressive') {
        const initialAnnualExpense = monthlyExpense * 12;
        const targetB1 = 4 * initialAnnualExpense;
        const targetB2 = 6 * initialAnnualExpense;

        if (totalFunds >= targetB1 + targetB2) {
            b1 = targetB1;
            b2 = targetB2;
            b3 = totalFunds - b1 - b2;
        } else if (totalFunds >= targetB1) {
            b1 = targetB1;
            b2 = totalFunds - targetB1;
            b3 = 0;
        } else {
            b1 = totalFunds;
            b2 = 0;
            b3 = 0;
        }
    }

    let isFailed = false;
    let currentMonthlyExpense = monthlyExpense;

    // Tax Accumulators
    let yearlyWithdrawalB1 = 0;
    let yearlyWithdrawalB2 = 0;
    let yearlyWithdrawalB3 = 0;

    for (let m = 1; m <= months; m++) {
        // 0. Inflation Adjustment
        if (m > 1 && (m - 1) % 12 === 0) {
            // New Year Start
            currentMonthlyExpense = currentMonthlyExpense * (1 + inflationRate / 100);
        }

        let taxPaidThisMonth = 0;
        let ruleLog: string[] = [];

        const currentAnnualExpense = currentMonthlyExpense * 12;

        // 1. Proactive Replenishment (Pull)
        let pullToB1 = 0;
        let pullToB2 = 0;

        if (b1 < 3 * currentAnnualExpense) {
            ruleLog.push(`B1 Low (<3yr Exp)`);
            const needed = currentAnnualExpense;
            const available = b2;
            const amt = Math.min(needed, available);
            if (amt > 0) {
                b1 += amt;
                b2 -= amt;
                pullToB1 += amt;
            }
        }

        if (b2 < 3 * currentAnnualExpense) {
            ruleLog.push(`B2 Low (<3yr Exp)`);
            const needed = currentAnnualExpense;
            const available = b3;
            const amt = Math.min(needed, available);
            if (amt > 0) {
                b2 += amt;
                b3 -= amt;
                pullToB2 += amt;
            }
        }

        // 2. Withdraw Expense
        let withdrawalB1 = 0;
        let withdrawalB2 = 0;
        let withdrawalB3 = 0;

        if (b1 < currentMonthlyExpense) {
            ruleLog.push(`B1 Empty`);
            const deficit = currentMonthlyExpense - b1;
            withdrawalB1 = b1;
            b1 = 0;
            if (b2 >= deficit) {
                b2 -= deficit;
                withdrawalB2 = deficit;
            } else {
                ruleLog.push(`B2 Empty`);
                const deficit2 = deficit - b2;
                withdrawalB2 = b2;
                b2 = 0;
                if (b3 >= deficit2) {
                    b3 -= deficit2;
                    withdrawalB3 = deficit2;
                } else {
                    withdrawalB3 = b3;
                    b3 = 0;
                    isFailed = true;
                    ruleLog.push(`Bankruptcy`);
                }
            }
        } else {
            b1 -= currentMonthlyExpense;
            withdrawalB1 = currentMonthlyExpense;
        }

        // Accumulate for Tax
        yearlyWithdrawalB1 += withdrawalB1;
        yearlyWithdrawalB2 += withdrawalB2;
        yearlyWithdrawalB3 += withdrawalB3;

        // Pay Tax if Year End
        if (m % 12 === 0) {
            if (taxEnabled && !isFailed) {
                const incomeExemptBuckets = yearlyWithdrawalB1 + yearlyWithdrawalB2; // Taxed at Slab
                const incomeCapitalGain = yearlyWithdrawalB3; // Taxed at 12.5% (Assuming LTCG)

                const multiplier = isJoint ? 2 : 1;

                // LTCG Exemption (1.25L per person)
                const ltcgExemptPerPerson = 125000;
                const totalLtcgExempt = ltcgExemptPerPerson * multiplier;

                // Refactored to use helper
                const equityTax = calculateLTCG(incomeCapitalGain, totalLtcgExempt);

                // Slab Tax (Splitting between members)
                let slabTax = 0;
                if (isJoint) {
                    // Split income equally
                    const incomePerPerson = incomeExemptBuckets / 2;
                    const taxPerPerson = calculateTaxNewRegime(incomePerPerson);
                    slabTax = taxPerPerson * 2;
                } else {
                    slabTax = calculateTaxNewRegime(incomeExemptBuckets);
                }

                let totalTax = slabTax + equityTax;
                taxPaidThisMonth = totalTax;

                if (totalTax > 0) {
                    ruleLog.push(`Tax: ${Math.round(totalTax / 1000)}k`);
                }

                // Deduct Tax from buckets (B1 -> B2 -> B3)
                if (b1 >= totalTax) {
                    b1 -= totalTax;
                } else {
                    const rem = totalTax - b1;
                    b1 = 0;
                    if (b2 >= rem) {
                        b2 -= rem;
                    } else {
                        const rem2 = rem - b2;
                        b2 = 0;
                        if (b3 >= rem2) {
                            b3 -= rem2;
                        } else {
                            b3 = 0;
                            isFailed = true;
                            ruleLog.push(`Bankruptcy (Tax)`);
                        }
                    }
                }
            }

            // Reset yearly accumulators
            yearlyWithdrawalB1 = 0;
            yearlyWithdrawalB2 = 0;
            yearlyWithdrawalB3 = 0;

            // Annual Rebalancing
            if (annualRebalancing || strategyType === 'dynamic-aggressive') {
                const currentTotal = b1 + b2 + b3;
                if (currentTotal > 0) {
                    if (strategyType === 'dynamic-aggressive') {
                        // Dynamic Rule: B1 = 4x Expense, B2 = 6x Expense (Total 10x)
                        // This logic runs annually to reset buffers
                        const nextYearExpense = currentAnnualExpense * (1 + inflationRate / 100); // Prepare for next year's need? or current? 
                        // User said "based on *that* year", which is usually the year entering.
                        // currentAnnualExpense is calculated at start of loop based on currentMonthlyExpense.

                        // Let's use currentAnnualExpense as the baseline for the "year"
                        const targetB1 = 4 * currentAnnualExpense;
                        const targetB2 = 6 * currentAnnualExpense;

                        // Prioritize filling B1, then B2, then B3
                        if (currentTotal >= targetB1 + targetB2) {
                            b1 = targetB1;
                            b2 = targetB2;
                            b3 = currentTotal - b1 - b2;
                        } else if (currentTotal >= targetB1) {
                            b1 = targetB1;
                            b2 = currentTotal - targetB1;
                            b3 = 0;
                        } else {
                            b1 = currentTotal;
                            b2 = 0;
                            b3 = 0;
                        }
                        ruleLog.push(`DynAgg Reset`);

                    } else if (annualRebalancing) {
                        // Check if allocations need reset
                        // Just reset to target %
                        b1 = currentTotal * normalizedAllocations[0];
                        b2 = currentTotal * normalizedAllocations[1];
                        b3 = currentTotal * normalizedAllocations[2];
                        ruleLog.push(`Rebalanced`);
                    }
                }
            }
        }

        if (isFailed) {
            history.push({
                month: m,
                bucket1: 0,
                bucket2: 0,
                bucket3: 0,
                totalFunds: 0,
                skimToB1: pullToB1,
                skimToB2: pullToB2,
                pullToB1: pullToB1,
                pushToB1: 0,
                pullToB2: pullToB2,
                pushToB2: 0,
                ruleLog: ruleLog.join(' | '),
                expense: currentMonthlyExpense,
                withdrawalB1,
                withdrawalB2,
                withdrawalB3,
                taxPaid: taxPaidThisMonth,
                returnB1: 0,
                returnAmountB1: 0,
                returnAmountB2: 0,
                returnAmountB3: 0,
                isFailed: true,
            });
            break;
        }

        // 3. Returns and Skimming
        const processBucket = (balance: number, returnRate: number, vol: number): [number, number, number] => {
            if (balance <= 0) return [0, 0, 0];
            const monthlyMean = returnRate / 12;
            const monthlyVol = vol / Math.sqrt(12);
            const randomZ = boxMullerTransform();
            const actualMonthlyReturn = monthlyMean + (randomZ * monthlyVol);
            const profit = balance * actualMonthlyReturn;
            const newBalance = Math.max(0, balance + profit);

            const thresholdReturn = monthlyMean + monthlyVol;
            let skim = 0;
            if (actualMonthlyReturn > thresholdReturn) {
                const excessRate = actualMonthlyReturn - thresholdReturn;
                skim = balance * excessRate;
            }
            return [newBalance - skim, skim, profit];
        };

        const b3Config = getBucketConfig(3);
        const [newB3, pushFrom3, profitB3] = processBucket(b3, b3Config.returnRate, b3Config.volatility);
        b3 = newB3;

        b2 += pushFrom3; // Add push

        const b2Config = getBucketConfig(2);
        const [newB2, pushFrom2, profitB2] = processBucket(b2, b2Config.returnRate, b2Config.volatility);
        b2 = newB2;

        b1 += pushFrom2; // Add push

        const b1Config = getBucketConfig(1);
        const [newB1, _, profitB1] = processBucket(b1, b1Config.returnRate, b1Config.volatility);
        b1 = newB1;

        const currentTotal = b1 + b2 + b3;
        if (currentTotal <= 0) {
            isFailed = true;
            ruleLog.push(`Bankruptcy (Zero Funds)`);
        }

        history.push({
            month: m,
            bucket1: b1,
            bucket2: b2,
            bucket3: b3,
            totalFunds: currentTotal,
            skimToB1: pullToB1 + pushFrom2,
            skimToB2: pullToB2 + pushFrom3,
            pullToB1: pullToB1,
            pushToB1: pushFrom2,
            pullToB2: pullToB2,
            pushToB2: pushFrom3,
            ruleLog: ruleLog.join(' | '),
            expense: currentMonthlyExpense,
            withdrawalB1,
            withdrawalB2,
            withdrawalB3,
            taxPaid: taxPaidThisMonth,
            returnB1: profitB1,
            returnAmountB1: profitB1,
            returnAmountB2: profitB2,
            returnAmountB3: profitB3,
            isFailed: isFailed || currentTotal < 0.01
        });

        if (isFailed) break;
    }

    // Temporary placeholder for successRate in single run
    return {
        monthsLasted: history.length,
        isSuccess: !isFailed,
        history,
        finalAmount: isFailed ? 0 : history[history.length - 1].totalFunds,
        successRate: !isFailed ? 100 : 0,
        totalSimulations: 1
    };
}

// Exported Wrapper
export function runSimulation({
    totalFunds,
    monthlyExpense,
    years = 30,
    inflationRate = 7,
    numSimulations = 1000,
    bucketAllocations,
    bucketConfigOverride,
    startAge,
    taxEnabled,
    isJoint,
    annualRebalancing,
    strategyType
}: SimulationParams & { inflationRate?: number, numSimulations?: number }): SimulationResult {
    const allResults: SimulationResult[] = [];
    let successCount = 0;

    for (let i = 0; i < numSimulations; i++) {
        const result = runSingleSimulation({
            totalFunds,
            monthlyExpense,
            years,
            inflationRate,
            bucketAllocations,
            bucketConfigOverride,
            startAge,
            taxEnabled,
            isJoint,
            annualRebalancing,
            strategyType
        });
        if (result.isSuccess) successCount++;
        allResults.push(result);
    }

    // Sort by final amount to find the median
    allResults.sort((a, b) => a.finalAmount - b.finalAmount);

    // Pick the median result for visualization
    const medianIndex = Math.floor(numSimulations / 2);
    // If median is failed but success rate is high, this might be interesting.
    // Usually median is representative.
    const representativeTrace = allResults[medianIndex];

    // Calculate aggregate success rate
    const successRate = (successCount / numSimulations) * 100;

    return {
        ...representativeTrace, // The history/finalAmount of the median run
        successRate: successRate, // The aggregate success rate
        totalSimulations: numSimulations
    };
}
