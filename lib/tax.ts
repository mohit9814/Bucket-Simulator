/**
 * FY24-25 New Tax Regime Calculation
 * Slabs:
 * 0-3L: Nil
 * 3-7L: 5% (Rebate u/s 87A makes it 0)
 * 7-10L: 10%
 * 10-12L: 15%
 * 12-15L: 20%
 * >15L: 30%
 * 
 * Includes 4% Health & Education Cess
 */
export function calculateTaxNewRegime(income: number): number {
    if (income <= 300000) return 0;

    // Rebate u/s 87A for income up to 7L
    if (income <= 700000) return 0;

    let tax = 0;
    if (income > 1500000) {
        tax = 140000 + (income - 1500000) * 0.30;
    } else if (income > 1200000) {
        // Range 12-15L
        tax = 80000 + (income - 1200000) * 0.20;
    } else if (income > 1000000) {
        // Range 10-12L
        tax = 50000 + (income - 1000000) * 0.15;
    } else if (income > 700000) {
        // Range 7-10L
        tax = 20000 + (income - 700000) * 0.10;
    } else {
        // Fallback for logic completeness, though covered by rebate check
        tax = (income - 300000) * 0.05;
    }

    // Add 4% Cess
    return tax * 1.04;
}

/**
 * Calculates Long Term Capital Gains Tax
 * @param gainAmount Total gain amount
 * @param exemptionLimit Exemption limit (default 1.25L, can be doubled for joint)
 * @param rate Tax rate (default 0.125 for 12.5%)
 */
export function calculateLTCG(gainAmount: number, exemptionLimit: number = 125000, rate: number = 0.125): number {
    const taxableAmount = Math.max(0, gainAmount - exemptionLimit);
    return taxableAmount * rate;
}
