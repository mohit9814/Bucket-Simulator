import { SimulationParams, FireMode } from "@/types";

export const ConfigSerializer = {
    serialize: (params: any): string => {
        try {
            // Create a minified version of params to save space URL
            const minified = {
                e: params.expense,
                m: params.mode,
                y: params.years,
                i: params.inflation,
                r: params.isr,
                b: params.bucketAllocations,
                s: params.startAge,
                t: params.taxEnabled ? 1 : 0,
                j: params.isJoint ? 1 : 0,
                a: params.annualRebalancing ? 1 : 0,
                st: params.strategyType,
                eq: params.equityFreezeYears,
                bo: params.bucketConfigOverride // This might be large, but necessary if custom
            };
            const json = JSON.stringify(minified);
            return btoa(json);
        } catch (e) {
            console.error("Serialization failed", e);
            return "";
        }
    },

    deserialize: (str: string): any | null => {
        try {
            const json = atob(str);
            const minified = JSON.parse(json);

            // Reconstruct full params
            return {
                expense: minified.e,
                mode: minified.m as FireMode,
                years: minified.y,
                inflation: minified.i,
                isr: minified.r,
                bucketAllocations: minified.b,
                startAge: minified.s,
                taxEnabled: minified.t === 1,
                isJoint: minified.j === 1,
                annualRebalancing: minified.a === 1,
                strategyType: minified.st || 'three-bucket',
                equityFreezeYears: minified.eq || 0,
                bucketConfigOverride: minified.bo
            };
        } catch (e) {
            console.error("Deserialization failed", e);
            return null;
        }
    }
};
