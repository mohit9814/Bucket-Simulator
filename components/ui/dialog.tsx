"use client";

import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
}

// Re-implementing correctly with Context
const DialogContext = React.createContext<{ open: boolean; onOpenChange: (open: boolean) => void }>({
    open: false,
    onOpenChange: () => { },
});

export function Dialog({ open, onOpenChange, children }: DialogProps) {
    return (
        <DialogContext.Provider value={{ open, onOpenChange }}>
            {children}
        </DialogContext.Provider>
    );
}

export function DialogTrigger({ asChild, children }: { asChild?: boolean, children: React.ReactNode }) {
    const { onOpenChange } = React.useContext(DialogContext);

    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<any>, {
            onClick: (e: any) => {
                // Safely call existing onClick if present
                (children as React.ReactElement<any>).props.onClick?.(e);
                onOpenChange(true);
            }
        });
    }

    return (
        <button onClick={() => onOpenChange(true)}>
            {children}
        </button>
    );
}

import { createPortal } from "react-dom";

export function DialogContent({ children, className }: { children: React.ReactNode, className?: string }) {
    const { open, onOpenChange } = React.useContext(DialogContext);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
        // Optional: Lock body scroll
        if (open) {
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    if (!open || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in"
                onClick={() => onOpenChange(false)}
            />
            <div className={cn(
                "relative z-[9999] w-full max-w-lg rounded-xl border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200",
                className
            )}>
                <button
                    onClick={() => onOpenChange(false)}
                    className="absolute z-50 right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                >
                    <X className="h-6 w-6" />
                    <span className="sr-only">Close</span>
                </button>
                {children}
            </div>
        </div>,
        document.body
    );
}
