"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimulationResult } from "@/types";
import { AlertTriangle, CheckCircle, TrendingUp, FileText, FileSpreadsheet } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ResultsSummaryProps {
    result: SimulationResult;
    onExport?: (type: 'csv' | 'pdf') => void;
    onAnalyze?: () => void;
}

export function ResultsSummary({ result, onExport, onAnalyze }: ResultsSummaryProps) {
    const yearsLasted = (result.monthsLasted / 12).toFixed(1);
    const isSuccess = result.isSuccess;
    const successRate = result.successRate !== undefined ? result.successRate.toFixed(1) : (isSuccess ? "100" : "0");

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className={Number(successRate) > 90 ? "bg-green-50/50 border-green-200" : Number(successRate) > 75 ? "bg-yellow-50/50 border-yellow-200" : "bg-red-50/50 border-red-200"}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        {isSuccess ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                        Success Probability
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {successRate}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Based on {result.totalSimulations || 1} simulations
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Duration Lasted</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{yearsLasted} Years</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Out of 30 year target
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        Final Corpus
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatINR(result.finalAmount)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Remaining simulated value
                    </p>
                </CardContent>
            </Card>

            {onExport && (
                <div className="md:col-span-3 flex justify-end gap-2 mt-2">
                    <Button variant="outline" size="sm" onClick={() => onAnalyze?.()}>
                        <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
                        Analyze Volatility
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onExport('csv')}>
                        <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                        Download Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onExport('pdf')}>
                        <FileText className="w-4 h-4 mr-2 text-red-600" />
                        Download PDF
                    </Button>
                </div>
            )}
        </div>
    );
}
