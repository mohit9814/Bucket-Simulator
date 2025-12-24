/**
 * Generates a random number from a standard normal distribution (mean=0, variance=1)
 * using the Box-Muller transform.
 */
export function boxMullerTransform(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0;
}
