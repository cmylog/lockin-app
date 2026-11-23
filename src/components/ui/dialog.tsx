"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const DialogContext = React.createContext<{ open: boolean; onOpenChange: (value: boolean) => void }>({ open: false, onOpenChange: () => {} });
function Dialog({ open = false, onOpenChange = () => {}, children }: { open?: boolean; onOpenChange?: (value: boolean) => void; children: React.ReactNode }) { return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>; }
function DialogTrigger({ children, ...props }: React.ComponentProps<"button">) { const { onOpenChange } = React.useContext(DialogContext); return <button onClick={() => onOpenChange(true)} {...props}>{children}</button>; }
function DialogContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const { open, onOpenChange } = React.useContext(DialogContext);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (!open) return; const previous = document.activeElement as HTMLElement | null; const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onOpenChange(false); if (event.key === "Tab") { const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled)") ?? []); const first = elements[0]; const last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }; document.addEventListener("keydown", handleKey); document.body.style.overflow = "hidden"; const focus = window.setTimeout(() => ref.current?.querySelector<HTMLElement>("input,button")?.focus(), 0); return () => { document.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; window.clearTimeout(focus); previous?.focus(); }; }, [open]);
  if (!open) return null;
  return createPortal(<><div data-slot="dialog-overlay" className="fixed inset-0 z-50 bg-black/70" onClick={() => onOpenChange(false)} /><div ref={ref} role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description" data-slot="dialog-content" className={cn("fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-background p-6 shadow-lg", className)} {...props}>{children}<button data-slot="dialog-close" type="button" className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100" aria-label="Close dialog" onClick={() => onOpenChange(false)}><XIcon className="size-4" /></button></div></>, document.body);
}
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex flex-col gap-2 text-left", className)} {...props} />; }
function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) { return <h2 id="dialog-title" className={cn("text-lg font-semibold", className)} {...props} />; }
function DialogDescription({ className, ...props }: React.ComponentProps<"p">) { return <p id="dialog-description" data-slot="dialog-description" className={cn("text-sm text-muted-foreground", className)} {...props} />; }
export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription };
