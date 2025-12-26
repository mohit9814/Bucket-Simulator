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
import html2canvas from 'html2canvas';

import { VolatilityAnalysisModal } from "@/components/features/VolatilityAnalysisModal";
import { ExportService } from "@/lib/export";
import { cn } from "@/lib/utils";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Settings2, BarChart3, Table as TableIcon, FileText, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScenarioComparisonChart } from "@/components/features/ScenarioComparisonChart";
import { ConfigSerializer } from "@/lib/config-serializer";

export default function Home() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [monthsToRun, setMonthsToRun] = useState(0);
  const [viewMode, setViewMode] = useState<'config' | 'results'>('config');
  const [isCopied, setIsCopied] = useState(false);

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
    annualRebalancing?: boolean;
    strategyType: StrategyType;
    bucketConfigOverride?: { [key: number]: { returnRate: number, volatility: number } };
    equityFreezeYears?: number;
  } | null>(null);

  // Load config from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const configStr = searchParams.get('config');
      if (configStr) {
        const params = ConfigSerializer.deserialize(configStr);
        if (params) {
          // Auto-run
          handleRunSimulation(
            params.expense, params.mode, params.years, params.inflation,
            1000, // Default sims
            params.isr, params.bucketAllocations, params.startAge,
            params.taxEnabled, params.isJoint, params.annualRebalancing,
            params.strategyType, params.bucketConfigOverride, params.equityFreezeYears
          );
        }
      }
    }
  }, []);

  // Hook handles the 'tick' for playback
  const { currentMonth, isPlaying, speed, setSpeed, togglePlay, reset, setProgress } = useSimulationRunner(monthsToRun);

  const [activeTab, setActiveTab] = useState("projection");

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

    const params = { expense, mode, years, inflation, isr, bucketAllocations, startAge, taxEnabled, isJoint, annualRebalancing, bucketConfigOverride, strategyType, equityFreezeYears };
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
    setActiveTab("projection"); // Reset to projection on new run
  };

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!result || !currentParams) return;

    if (type === 'csv') {
      ExportService.downloadCSV({ result, params: currentParams });
    } else {
      // Capture charts
      // Must switch to projection tab to ensure charts are rendered
      const previousTab = activeTab;
      if (previousTab !== 'projection') {
        setActiveTab('projection');
        // Wait for render
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const charts: { [key: string]: string } = {};

      try {
        const wealthEl = document.getElementById('chart-wealth-projection');
        if (wealthEl) {
          const canvas = await html2canvas(wealthEl, { scale: 2 });
          charts.wealthProjection = canvas.toDataURL('image/png');
        }

        const scenarioEl = document.getElementById('chart-scenario-comparison');
        if (scenarioEl) {
          const canvas = await html2canvas(scenarioEl, { scale: 2 });
          charts.scenarioComparison = canvas.toDataURL('image/png');
        }

        const replenishEl = document.getElementById('chart-replenishment-volume');
        if (replenishEl) {
          const canvas = await html2canvas(replenishEl, { scale: 2 });
          charts.replenishmentVolume = canvas.toDataURL('image/png');
        }
      } catch (e) {
        console.error("Failed to capture charts", e);
      }

      // Restore tab if changed
      if (previousTab !== 'projection') {
        setActiveTab(previousTab);
      }

      ExportService.downloadPDF({ result, params: currentParams }, charts);
    }
  };

  const handleShare = () => {
    if (!currentParams) return;
    const configStr = ConfigSerializer.serialize(currentParams);
    const url = `${window.location.origin}${window.location.pathname}?config=${configStr}`;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
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
        <div className="flex gap-2">
          {viewMode === 'results' && (
            <>
              <Button
                variant="outline"
                onClick={handleShare}
                className="flex items-center gap-2"
              >
                {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
                {isCopied ? "Copied!" : "Share Analysis"}
              </Button>

              <Button
                variant="outline"
                onClick={() => setViewMode('config')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Config
              </Button>
            </>
          )}
        </div>
      </div>

      <div className={cn("max-w-4xl mx-auto transition-opacity duration-300", viewMode === 'config' ? 'opacity-100 block' : 'opacity-0 hidden absolute inset-0 -z-10')}>
        <ConfigForm onRunSimulation={handleRunSimulation} initialValues={currentParams} />
      </div>

      <div className={cn("space-y-6 animate-in fade-in slide-in-from-right-8 duration-500", viewMode === 'results' ? 'block' : 'hidden')}>
        {/* Results Header */}
        <div className="grid gap-6">
          {result && <ResultsSummary result={result} onExport={handleExport} onAnalyze={() => setIsAnalysisOpen(true)} targetYears={currentParams?.years} />}

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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                    <div id="chart-wealth-projection">
                      <SimulationChart
                        history={displayedHistory}
                        startAge={currentParams?.startAge}
                        title="Wealth Projection - Median Scenario (Typical)"
                      />
                    </div>

                    {/* New Comparative Chart */}
                    <div id="chart-scenario-comparison">
                      <ScenarioComparisonChart
                        result={result}
                        startAge={currentParams?.startAge || 0}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="lg:col-span-1">
                <ReplenishmentLog history={displayedHistory} startAge={currentParams?.startAge} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="details" className="animate-in fade-in duration-300">
            {result && (
              <div className="h-full">
                <YearlyTable
                  history={result.history}
                  currentMonth={currentMonth}
                  startAge={currentParams?.startAge}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="log" className="animate-in fade-in duration-300">
            <div className="max-w-4xl mx-auto">
              <ReplenishmentLog history={displayedHistory} startAge={currentParams?.startAge} />
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
