import { runSimulation } from "@/lib/simulation";
import { FIRE_MODES } from "@/lib/constants";

describe("Retirement Bucket Simulator Logic", () => {

    // Helper to get consistent results:
    // We can't easily mock Math.random inside the module without rewriting the module to accept a seed or RNG.
    // However, for logical checks of flow (Replenishment, Withdrawal), we can use scenarios where market returns don't obscure the logic too much,
    // OR we can rely on the fact that returns are applied *after* withdrawal/replenishment in the month loop?
    // Let's look at the loop:
    // 1. Inflation
    // 2. Replenishment (Pull) <-- Deterministic based on balances
    // 3. Withdrawal <-- Deterministic based on balances
    // 4. Returns <-- Stochastic

    // So if we check state *after* a few months, returns will have affected it.
    // Ideally, for unit testing logic, we'd mock the return generator.
    // But for now, we can test "Extreme" cases or 1-month cases where returns are small compared to flows if needed.
    // Actually, checking "Replenishment" specifically is easier if we look at the specific trace values.

    const MOCK_EXPENSE = 100000;
    const MOCK_ISR = 50; // High ISR = Lots of funds
    const TOTAL_FUNDS = MOCK_EXPENSE * 12 * MOCK_ISR;

    it("should initialize buckets based on custom allocation", () => {
        const result = runSimulation({
            totalFunds: 3000000,
            monthlyExpense: 10000,
            bucketAllocations: [0.5, 0.3, 0.2],
            numSimulations: 1,
            years: 1
        });

        const firstMonth = result.history[0];
        // Note: history records purely the *end* of month state? 
        // Or rather, the loop processes flows then pushes to history.
        // So history[0] is State at End of Month 1.

        // Initial: 
        // B1 = 1.5M, B2 = 0.9M, B3 = 0.6M
        // Month 1 starts.
        // Funds withdraw from B1.
        // Returns applied.

        // We can't check exact values easily due to random returns, 
        // but we can check they are roughly correct magnitude.

        expect(firstMonth.bucket1).toBeGreaterThan(0);
        expect(firstMonth.bucket2).toBeGreaterThan(0);
        expect(firstMonth.bucket3).toBeGreaterThan(0);
    });

    it("should replenish Bucket 1 from Bucket 2 when B1 is low", () => {
        // Setup a case where B1 is deliberately low (e.g. allocation [0, 1, 0])
        // If B1 starts empty, it SHOULD pull from B2 immediately in Month 1 (Step 1 or Step 2).

        const result = runSimulation({
            totalFunds: 1200000, // 12L
            monthlyExpense: 10000, // 10k/mo -> 1.2L/yr
            // B1 = 0, B2 = 12L, B3 = 0
            bucketAllocations: [0.0, 1.0, 0.0],
            numSimulations: 1,
            years: 1
        });

        const m1 = result.history[0];

        // In Month 1:
        // 1. Proactive Replenishment:
        //    B1 (0) < 3 * Annual (3.6L). 
        //    Needed = 3.6L. Available B2 = 12L.
        //    Pull 3.6L from B2 to B1.
        //    B1 becomes 3.6L. B2 becomes 8.4L.
        // 2. Withdraw:
        //    Expense 10k. B1 becomes 3.59L.
        // 3. Returns applied.

        // Check trace for "pullToB1"
        expect(m1.pullToB1).toBeCloseTo(120000, -2); // Check if it pulled ~1 year or 3 years worth? 
        // Logic says: "if (b1 < 3 * currentAnnualExpense)" -> currently 3 * 1.2L = 3.6L.
        // "const needed = currentAnnualExpense;" -> Need 1.2L.
        // Wait, logic says `needed = currentAnnualExpense`. 
        // So it pulls 1 year of expenses, not 3.

        // So expected pull is 1.2L = 120,000.

        expect(m1.pullToB1).toBeGreaterThan(110000); // 1.2L roughly
        expect(m1.bucket1).toBeGreaterThan(100000); // Should have funds now
    });

    it("should cascade withdrawal to B2 if B1 is empty (and replenishment failed/insufficient)", () => {
        // Setup B1=0, B2=Low, B3=0 such that replenishment isn't enough?
        // Or just normal flow.
        // If we define B1=0, B2=Small Amount (e.g. 5000), B3=0.
        // Monthly Expense = 10000.

        const result = runSimulation({
            totalFunds: 5000,
            monthlyExpense: 10000,
            bucketAllocations: [0, 1, 0], // Put all 5k in B2
            numSimulations: 1,
            years: 1
        });

        const m1 = result.history[0];
        // 1. Replenishment:
        //    B1 < 3yr. Needed=1.2L. Avail B2=5k.
        //    Pull 5k to B1. B1=5k, B2=0.
        // 2. Withdraw:
        //    Expense 10k. B1 (5k) < 10k. 
        //    Deficit = 5k. B1=0.
        //    Try B2. B2=0. 
        //    Try B3. B3=0.
        //    Fail.

        // Verification:
        expect(m1.pullToB1).toBeCloseTo(5000, 1);
        expect(m1.isFailed).toBe(true);
        expect(m1.bucket1).toBe(0);
    });

    it("should replenish Bucket 2 from Bucket 3", () => {
        // B1 = Full, B2 = 0, B3 = Full
        // B1 doesn't need money.
        // B2 < 3 * Annual? Yes, 0 < 3.6L.
        // Pull 1yr from B3 to B2.

        const annualExpense = 120000;
        const total = annualExpense * 10; // 12L

        const result = runSimulation({
            totalFunds: total,
            monthlyExpense: 10000,
            bucketAllocations: [0.5, 0.0, 0.5], // B1=6L, B2=0, B3=6L
            numSimulations: 1,
            years: 1
        });

        const m1 = result.history[0];

        // B1 > 3*1.2L (3.6L)? Yes (6L). No pull to B1.
        // B2 (0) < 3*1.2L? Yes. 
        // Pull 1.2L from B3 to B2.

        expect(m1.pullToB2).toBeCloseTo(annualExpense, -2);
        expect(m1.bucket2).toBeGreaterThan(annualExpense * 0.9); // Should have ~1.2L plus/minus returns
    });

    it("should survive 30 years with adequate funding (Integration Test)", () => {
        const result = runSimulation({
            totalFunds: 10000 * 12 * 50, // 50x ISR
            monthlyExpense: 10000,
            bucketAllocations: [0.33, 0.33, 0.34],
            numSimulations: 1,
            years: 30
        });

        expect(result.isSuccess).toBe(true);
        expect(result.monthsLasted).toBe(360);
    });
});
