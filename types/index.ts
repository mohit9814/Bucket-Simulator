export type FireMode = 'Lean' | 'Chubby' | 'Fat' | 'Custom';

export interface FireConfig {
  isr: number; // Income Stability Ratio
  label: string;
}

export type StrategyType = 'three-bucket' | 'two-bucket' | 'dynamic-aggressive';

export interface SimulationParams {
  totalFunds: number;
  monthlyExpense: number;
  years?: number;
  inflationRate?: number;
  bucketAllocations?: [number, number, number];
  strategyType?: StrategyType;
  annualRebalancing?: boolean; // Reset to target allocation yearly
  bucketConfigOverride?: {
    [key: number]: {
      returnRate: number;
      volatility: number;
    }
  };
  startAge?: number;
  taxEnabled?: boolean;
  isJoint?: boolean; // Joint Assessment for Tax
  equityFreezeYears?: number;
}

export interface BucketConfig {
  id: 1 | 2 | 3;
  name: string;
  returnRate: number; // Annual return (mean)
  volatility: number; // Annual volatility (std dev)
  allocation: number; // Percentage or logic-based
}

export interface BucketState {
  currentAmount: number;
}

export interface MonthSimulation {
  month: number;
  bucket1: number;
  bucket2: number;
  bucket3: number;
  totalFunds: number;
  skimToB1: number; // Net transfer
  skimToB2: number; // Net transfer
  pullToB1: number; // Replenishment (Floor check)
  pushToB1: number; // Excess Returns from B2
  pullToB2: number; // Replenishment (Floor check)
  pushToB2: number; // Excess Returns from B3
  ruleLog?: string; // Log triggering rule (e.g. "B1 Low")
  expense: number; // Inflation adjusted expense for this month
  withdrawalB1: number;
  withdrawalB2: number;
  withdrawalB3: number;
  taxPaid: number;
  returnB1: number; // Keep for legacy if needed, or just standard return amountsh (annualized % or flat amount?) -> Let's store annualized % equivalent or actual absolute return?
  // User asked for "returns for each bucket". Absolute amount is clearer for table, but percentage is useful too.
  // Let's store Absolute Return Amount for now as it derives balance change.
  returnAmountB1: number;
  returnAmountB2: number;
  returnAmountB3: number;
  isFailed: boolean; // True if run out of money
}

export interface SimulationResult {
  monthsLasted: number;
  isSuccess: boolean;
  history: MonthSimulation[];
  finalAmount: number;
  successRate: number; // Percentage of simulations that succeeded
  totalSimulations: number;
  historyWorst?: MonthSimulation[]; // 10th percentile
  historyBest?: MonthSimulation[]; // 90th percentile
}
