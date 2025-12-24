import { calculateTaxNewRegime, calculateLTCG } from "@/lib/tax";

describe('Tax Logic', () => {
    describe('calculateTaxNewRegime', () => {
        const testCases = [
            { income: 250000, expected: 0 },
            { income: 300000, expected: 0 },
            { income: 500000, expected: 0 }, // Rebate
            { income: 700000, expected: 0 }, // Rebate limit
            { income: 700100, expected: 20810.4 }, // 20k + 10 [ces not applicable on rebate but here rebate gone] -> 20000 + 10 = 20010 + 4% cess? Wait logic:
            // 0-3L: 0
            // 3-7L: 5% (20000)
            // 7-7.001L: 10% on excess (10)
            // Total Tax = 20000 + 10 = 20010 * 1.04 = 20810.4

            { income: 900000, expected: 41600 },
            // 0-3L: 0
            // 3-7L: 20k
            // 7-9L: 20k
            // Total: 40k * 1.04 = 41600

            { income: 1000000, expected: 52000 },
            // 0-3L: 0
            // 3-7L: 20k
            // 7-10L: 30k
            // Total: 50k * 1.04 = 52000

            { income: 1500000, expected: 145600 },
            // 0-3L: 0
            // 3-7L: 20k
            // 7-10L: 30k
            // 10-12L: 30k
            // 12-15L: 60k
            // Total: 140k * 1.04 = 145600
        ];

        testCases.forEach(({ income, expected }) => {
            it(`should calculate correct tax for income ${income}`, () => {
                const tax = calculateTaxNewRegime(income);
                expect(tax).toBeCloseTo(expected, 1);
            });
        });
    });

    describe('calculateLTCG', () => {
        it('should return 0 if gain is below exemption', () => {
            expect(calculateLTCG(100000, 125000)).toBe(0);
        });

        it('should tax excess at 12.5%', () => {
            const gain = 225000;
            const exemption = 125000;
            const taxable = 100000;
            const expected = taxable * 0.125;
            expect(calculateLTCG(gain, exemption)).toBe(expected);
        });

        it('should handle custom exemption (Joint)', () => {
            const gain = 300000;
            const exemption = 250000; // Joint
            const taxable = 50000;
            const expected = taxable * 0.125;
            expect(calculateLTCG(gain, exemption)).toBe(expected);
        });
    });
});
