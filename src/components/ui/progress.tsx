"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

function Progress({ className, value = 0, ...props }: React.ComponentProps<"div"> & { value?: number }) {
  const amount = Math.max(0, Math.min(100, value));
  return <div data-slot="progress" role="progressbar" aria-valuenow={amount} aria-valuemin={0} aria-valuemax={100} className={cn("relative h-2 w-full overflow-hidden rounded-full bg-secondary", className)} {...props}><div data-slot="progress-indicator" className="h-full bg-primary transition-all" style={{ width: `${amount}%` }} /></div>;
}
export { Progress };
