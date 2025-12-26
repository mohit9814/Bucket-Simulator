"use client"

import { MonthSimulation } from "@/types";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { formatINR } from "@/lib/utils";

interface SimulationChartProps {
    history: MonthSimulation[];
    startAge?: number;
    title?: string;
}

export function SimulationChart({ history, startAge, title = "Wealth Projection" }: SimulationChartProps) {
    if (!history || history.length === 0) return null;

    // Downsample if too many points for performance
    const data = history.filter((_, index) => index % 12 === 0 || index === history.length - 1).map(h => {
        const year = Math.floor(h.month / 12);
        return {
            ...h,
            year,
            age: startAge ? startAge + year : undefined,
            Funds: Math.round(h.totalFunds),
            "Bucket 1": Math.round(h.bucket1),
            "Bucket 2": Math.round(h.bucket2),
            "Bucket 3": Math.round(h.bucket3),
        };
    });

    return (
        <Card className="glass-card w-full h-[300px] md:h-[500px]">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>Projected portfolio value over time (Stacked by Bucket)</CardDescription>
            </CardHeader>
            <CardContent className="h-[200px] md:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{
                            top: 10,
                            right: 30,
                            left: 0,
                            bottom: 0,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis
                            dataKey={startAge ? "age" : "year"}
                            tickFormatter={(v) => startAge ? `Age ${v}` : `Yr ${v}`}
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#888888"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => formatINR(val)}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ color: '#333' }}
                            labelStyle={{ color: '#666' }}
                            formatter={(value: any) => [formatINR(Number(value)), ""]}
                            labelFormatter={(label) => startAge ? `Age ${label}` : `Year ${label}`}
                        />
                        <Legend verticalAlign="top" height={36} />
                        <Area type="monotone" name="Bucket 3 (Growth)" dataKey="Bucket 3" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                        <Area type="monotone" name="Bucket 2 (Conservative)" dataKey="Bucket 2" stackId="1" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                        <Area type="monotone" name="Bucket 1 (Cash)" dataKey="Bucket 1" stackId="1" stroke="#ffc658" fill="#ffc658" fillOpacity={0.6} />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
