"use client"

import { ConfigForm } from "@/components/features/ConfigForm";
import { PlaybackControls } from "@/components/features/PlaybackControls";
import { ReplenishmentLog } from "@/components/features/ReplenishmentLog";
import { ResultsSummary } from "@/components/features/ResultsSummary";
import { SimulationChart } from "@/components/features/SimulationChart";
import { YearlyTable } from "@/components/features/YearlyTable";
import { useSimulationRunner } from "@/hooks/useSimulationRunner";
import { calculateRequiredFunds, runSimulation } from "@/lib/simulation";
import { FireMode, SimulationResult, StrategyType } from "@/types";
import { useEffect, useState } from "react";

import { VolatilityAnalysisModal } from "@/components/features/VolatilityAnalysisModal";
import { ExportService } from "@/lib/export";
import { cn } from "@/lib/utils";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Settings2, BarChart3, Table as TableIcon, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [monthsToRun, setMonthsToRun] = useState(0);
  const [viewMode, setViewMode] = useState<'config' | 'results'>('config');

  const [currentParams, setCurrentParams] = useState<{
    expense: number;
    mode: FireMode;
    years: number;
    inflation: number;
    isr: number;
    bucketAllocations: [number, number, number];
    startAge?: number;
    taxEnabled?: boolean;
    isJoint?: boolean;
    bucketConfigOverride?: { [key: number]: { returnRate: number, volatility: number } };
  } | null>(null);

  // Hook handles the 'tick' for playback
  const { currentMonth, isPlaying, speed, setSpeed, togglePlay, reset, setProgress } = useSimulationRunner(monthsToRun);

  const handleRunSimulation = (
    expense: number,
    mode: FireMode,
    years: number,
    inflation: number,
    numSimulations: number,
    isr: number,
    bucketAllocations: [number, number, number],
    startAge?: number,
    taxEnabled?: boolean,
    isJoint?: boolean,
    annualRebalancing?: boolean,
    strategyType: StrategyType = 'three-bucket',
    bucketConfigOverride?: { [key: number]: { returnRate: number, volatility: number } },
    equityFreezeYears?: number
  ) => {
    // Mode is for display/logging mainly now, ISR is explicit
    const requiredFunds = calculateRequiredFunds(expense, isr);

    const params = { expense, mode, years, inflation, isr, bucketAllocations, startAge, taxEnabled, isJoint, annualRebalancing, bucketConfigOverride };
    setCurrentParams(params);

    // Calculate all data upfront
    const simResult = runSimulation({
      totalFunds: requiredFunds,
      monthlyExpense: expense,
      years: years,
      inflationRate: inflation,
      numSimulations: numSimulations,
      bucketAllocations: bucketAllocations,
      startAge: startAge,
      taxEnabled: taxEnabled,
      isJoint: isJoint,
      annualRebalancing: annualRebalancing,
      bucketConfigOverride: bucketConfigOverride,
      strategyType: strategyType,
      equityFreezeYears: equityFreezeYears
    });

    setResult(simResult);
    setMonthsToRun(years * 12);
    setViewMode('results');
  };

  const handleExport = (type: 'csv' | 'pdf') => {
    if (!result || !currentParams) return;

    if (type === 'csv') {
      ExportService.downloadCSV({ result, params: currentParams });
    } else {
      ExportService.downloadPDF({ result, params: currentParams });
    }
  };

  // Derived current state based on playback
  const displayedHistory = result ? result.history.slice(0, currentMonth) : [];

  const currentYearVal = Math.floor(currentMonth / 12);
  const totalYearsVal = monthsToRun / 12;

  return (
    <main className="min-h-screen p-4 md:p-8 lg:p-12 max-w-[1600px] mx-auto space-y-6">

      {/* Header - Conditional Size? Keep simple for now */}
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Retirement Bucket Simulator
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Visualize your wealth preservation strategy.
          </p>
        </div>
        {viewMode === 'results' && (
          <Button
            variant="outline"
            onClick={() => setViewMode('config')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Config
          </Button>
        )}
      </div>

      <div className={cn("max-w-4xl mx-auto transition-opacity duration-300", viewMode === 'config' ? 'opacity-100 block' : 'opacity-0 hidden absolute inset-0 -z-10')}>
        <ConfigForm onRunSimulation={handleRunSimulation} />
      </div>

      <div className={cn("space-y-6 animate-in fade-in slide-in-from-right-8 duration-500", viewMode === 'results' ? 'block' : 'hidden')}>
        {/* Results Header */}
        <div className="grid gap-6">
          {result && <ResultsSummary result={result} onExport={handleExport} onAnalyze={() => setIsAnalysisOpen(true)} />}

          <PlaybackControls
            isPlaying={isPlaying}
            speed={speed}
            currentYear={currentYearVal}
            totalYears={totalYearsVal}
            onTogglePlay={togglePlay}
            onReset={reset}
            onSpeedChange={setSpeed}
          />
        </div>

        {/* Tabs for Detailed Views */}
        <Tabs defaultValue="projection" className="w-full">
          <div className="flex justify-center mb-6">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="projection" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Projection
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-2">
                <TableIcon className="w-4 h-4" />
                Yearly Details
              </TabsTrigger>
              <TabsTrigger value="log" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Log
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="projection" className="space-y-4 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-8">
                {result && displayedHistory.length > 0 && (
                  <>
                    <SimulationChart
                      history={displayedHistory}
                      startAge={currentParams?.startAge}
                      title="Wealth Projection - Median Scenario (Typical)"
                    />
                    {result.historyWorst && (
                      <SimulationChart
                        history={result.historyWorst}
                        startAge={currentParams?.startAge}
                        title="Wealth Projection - Worst Scenario (10th Percentile)"
                      />
                    )}
                    {result.historyBest && (
                      <SimulationChart
                        history={result.historyBest}
                        startAge={currentParams?.startAge}
                        title="Wealth Projection - Best Scenario (90th Percentile)"
                      />
                    )}
                  </>
                )}
              </div>
              <div className="lg:col-span-1">
                <ReplenishmentLog history={displayedHistory} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="details" className="animate-in fade-in duration-300">
            {result && (
              <div className="h-full">
                <YearlyTable history={result.history} currentMonth={currentMonth} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="log" className="animate-in fade-in duration-300">
            <div className="max-w-4xl mx-auto">
              <ReplenishmentLog history={displayedHistory} />
            </div>
          </TabsContent>
        </Tabs>
      </div>


      <VolatilityAnalysisModal
        isOpen={isAnalysisOpen}
        onClose={() => setIsAnalysisOpen(false)}
        currentParams={currentParams}
      />
    </main >
  );
}
