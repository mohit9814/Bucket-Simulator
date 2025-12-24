
import { runSimulation } from '../lib/simulation';
import { BUCKETS } from '../lib/constants';

describe('Volatility Logic Validation', () => {

    // Helper to extract monthly return percentages from history
    // We'll simulate 1 year only to keep it simple

    test('Volatility 0 should produce constant returns exactly equal to mean', () => {
        const result = runSimulation({
            totalFunds: 1000000,
            monthlyExpense: 0, // No withdrawal to complicate balance
            years: 1,
            inflationRate: 0,
            numSimulations: 1,
            bucketAllocations: [1, 0, 0], // 100% in Bucket 1
            bucketConfigOverride: {
                1: { returnRate: 0.06, volatility: 0 } // 6% return, 0% vol. Monthly = 0.5%
            }
        });

        // Check history
        // Month 1: 1M + 0.5% = 1,005,000.
        // Month 12: should be 1M * (1.005)^12

        let prevBalance = 1000000;
        const expectedMonthlyRate = 0.06 / 12; // 0.005

        result.history.forEach((h, i) => {
            // Check implicit return
            // row.returnAmountB1 should be exactly Balance * 0.005
            // But wait, simulation calculates return on Start Balance.
            // Balance in history is End Balance.
            // Previous Row's Balance is Start Balance.

            const startBal = i === 0 ? 1000000 : result.history[i - 1].bucket1;
            const expectedReturn = startBal * expectedMonthlyRate;

            expect(h.returnAmountB1).toBeCloseTo(expectedReturn, 2);
            expect(h.bucket1).toBeCloseTo(startBal + expectedReturn, 2);
        });

        // Also ensure NO variability at all
        const returns = result.history.map(h => h.returnAmountB1);
        const firstRet = returns[0];
        // Returns increase as balance compounds, so they won't be identical.
        // But the RATE should be identical.
    });

    test('Volatility increases deviation from mean', () => {
        // Run with High Volatility (50%)
        const resultHigh = runSimulation({
            totalFunds: 1000000,
            monthlyExpense: 0,
            years: 1,
            inflationRate: 0,
            numSimulations: 1,
            bucketAllocations: [1, 0, 0],
            bucketConfigOverride: {
                1: { returnRate: 0.06, volatility: 0.50 }
            }
        });

        // Run with Low Volatility (2%)
        const resultLow = runSimulation({
            totalFunds: 1000000,
            monthlyExpense: 0,
            years: 1,
            inflationRate: 0,
            numSimulations: 1,
            bucketAllocations: [1, 0, 0],
            bucketConfigOverride: {
                1: { returnRate: 0.06, volatility: 0.02 }
            }
        });

        // Calculate variance of implied monthly return RATES
        // Rate = Amount / StartBalance
        const getRates = (res: any) => res.history.map((h: any, i: number) => {
            const startBal = i === 0 ? 1000000 : res.history[i - 1].bucket1;
            return h.returnAmountB1 / startBal;
        });

        const ratesHigh = getRates(resultHigh);
        const ratesLow = getRates(resultLow);

        const calcStdDev = (arr: number[]) => {
            const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
            const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
            return Math.sqrt(variance);
        };

        const sdHigh = calcStdDev(ratesHigh);
        const sdLow = calcStdDev(ratesLow);

        console.log(`High Vol SD: ${sdHigh.toFixed(5)}, Low Vol SD: ${sdLow.toFixed(5)}`);

        // High Vol SD should be roughly 0.50 / sqrt(12) = 0.144
        // Low Vol SD should be roughly 0.02 / sqrt(12) = 0.0057

        expect(sdHigh).toBeGreaterThan(sdLow * 10); // Should be much larger
        expect(sdLow).toBeLessThan(0.01); // Should be very small
    });

    test('Negative Volatility input is treated as absolute or error?', () => {
        // Ideally we handle this, but checking behavior
        // Math.random returns 0-1.
        // The math uses `vol`, so negative would just flip the sign of the random noise.
        // Distribution should be same (symmetric).
    });

    test('Simulate User Scenario: High Swings Check', () => {
        // Run 100 simulations of 1 year each for B1 (2% vol)
        let negativeDeficitCount = 0;

        for (let i = 0; i < 100; i++) {
            const res = runSimulation({
                totalFunds: 6000000, // 60L
                monthlyExpense: 0,
                years: 1,
                inflationRate: 0,
                numSimulations: 1,
                bucketAllocations: [1, 0, 0],
                bucketConfigOverride: { 1: { returnRate: 0.055, volatility: 0.02 } }
            });

            // Check if any month had return < -2% (absolute nonsense for B1)
            // Monthly return < -2% means Rate < -0.02.
            // Mean 0.0045. Vol 0.0057.
            // -0.02 is ( -0.02 - 0.0045 ) / 0.0057 = -4.2 Sigma.
            // Probability ~ 1 in 30,000 months.
            // In 100 sims * 12 months = 1200 months. Unlikely to see any.

            const rates = res.history.map((h: any, idx: number) => {
                const startBal = idx === 0 ? 6000000 : res.history[idx - 1].bucket1;
                return h.returnAmountB1 / startBal;
            });

            if (rates.some(r => r < -0.02)) {
                negativeDeficitCount++;
            }
        }

        expect(negativeDeficitCount).toBe(0);
    });

});
