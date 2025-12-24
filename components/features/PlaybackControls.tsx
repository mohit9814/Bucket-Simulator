"use client"

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PlaybackSpeed } from "@/hooks/useSimulationRunner";
import { cn } from "@/lib/utils";
import { Pause, Play, RotateCcw, Zap } from "lucide-react";

interface PlaybackControlsProps {
    isPlaying: boolean;
    speed: PlaybackSpeed;
    currentYear: number;
    totalYears: number;
    onTogglePlay: () => void;
    onReset: () => void;
    onSpeedChange: (speed: PlaybackSpeed) => void;
}

export function PlaybackControls({
    isPlaying,
    speed,
    currentYear,
    totalYears,
    onTogglePlay,
    onReset,
    onSpeedChange
}: PlaybackControlsProps) {

    const speeds: { value: PlaybackSpeed; label: string; icon?: any }[] = [
        { value: 'slower', label: 'Slow' },
        { value: 'slow', label: 'Medium' },
        { value: 'normal', label: 'Fast' },
    ];

    return (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-background/50 backdrop-blur-sm border rounded-xl shadow-sm sticky top-4 z-10 w-full mb-6">
            <div className="flex items-center gap-4">
                <Button
                    onClick={onTogglePlay}
                    size="icon"
                    className={cn("h-12 w-12 rounded-full shadow-md transition-all hover:scale-105", isPlaying ? "bg-amber-500 hover:bg-amber-600" : "bg-primary hover:bg-primary/90")}
                >
                    {isPlaying ? <Pause className="fill-white" /> : <Play className="fill-white ml-1" />}
                </Button>

                <div className="flex flex-col">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Simulation Year</span>
                    <span className="text-2xl font-bold font-mono text-primary leading-none">
                        {currentYear} <span className="text-sm text-muted-foreground font-normal">/ {totalYears}</span>
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                {speeds.map((s) => (
                    <button
                        key={s.value}
                        onClick={() => onSpeedChange(s.value)}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            speed === s.value
                                ? "bg-background shadow-sm text-primary"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {s.label}
                    </button>
                ))}
                <div className="w-[1px] h-4 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onReset} title="Reset">
                    <RotateCcw className="w-3.5 h-3.5" />
                </Button>
            </div>
        </div>
    );
}
