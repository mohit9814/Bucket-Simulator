import { BucketConfig, FireConfig, FireMode } from "@/types";

export const FIRE_MODES: Record<FireMode, FireConfig> = {
    Lean: { isr: 20, label: "Lean FIRE" },
    Chubby: { isr: 24, label: "Chubby FIRE" },
    Fat: { isr: 33, label: "Fat FIRE" },
    Custom: { isr: 25, label: "Custom" },
};

export const BUCKETS: BucketConfig[] = [
    {
        id: 1,
        name: "Stable Income",
        returnRate: 0.055,
        volatility: 0.01, // 3Y derived -> annualized? Keeping simple as requested params: 5% return, 2% vol
        allocation: 0.3333,
    },
    {
        id: 2,
        name: "Low Volatility",
        returnRate: 0.09,
        volatility: 0.05,
        allocation: 0.3333,
    },
    {
        id: 3,
        name: "Growth/Equity",
        returnRate: 0.13,
        volatility: 0.14,
        allocation: 0.3333,
    },
];
