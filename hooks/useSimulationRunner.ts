import { useState, useEffect, useRef } from 'react';

export type PlaybackSpeed = 'slower' | 'slow' | 'normal' | 'fast';

const SPEEDS = {
    slower: 500,
    slow: 200,
    normal: 50,
    fast: 10
};

export function useSimulationRunner(totalMonths: number) {
    const [currentMonth, setCurrentMonth] = useState(totalMonths); // Default to end state
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState<PlaybackSpeed>('normal');
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Reset when totalMonths changes (new simulation run)
    useEffect(() => {
        // If we want auto-play, we could set 0 and isPlaying true.
        // Ideally, start at end to show results immediately, but allow replay.
        // Or start at 0 and play?
        // Let's start at the end so users see results instantly, but can click 'Replay'.
        setCurrentMonth(totalMonths);
        setIsPlaying(false);
    }, [totalMonths]);

    useEffect(() => {
        if (isPlaying) {
            timerRef.current = setInterval(() => {
                setCurrentMonth(prev => {
                    if (prev >= totalMonths) {
                        setIsPlaying(false);
                        return totalMonths;
                    }
                    return prev + 1;
                });
            }, SPEEDS[speed]);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isPlaying, speed, totalMonths]);

    const togglePlay = () => {
        if (currentMonth >= totalMonths) {
            // Restart
            setCurrentMonth(0);
            setIsPlaying(true);
        } else {
            setIsPlaying(!isPlaying);
        }
    };

    const reset = () => {
        setIsPlaying(false);
        setCurrentMonth(0);
    }

    const setProgress = (month: number) => {
        setIsPlaying(false);
        setCurrentMonth(Math.min(month, totalMonths));
    }

    return {
        currentMonth,
        isPlaying,
        speed,
        setSpeed,
        togglePlay,
        reset,
        setProgress
    };
}
