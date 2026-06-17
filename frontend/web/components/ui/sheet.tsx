"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

// iOS-style bottom sheet — built on Radix Dialog (focus trap, escape, scroll
// lock, a11y) but anchored to the bottom with a grab handle, glass material,
// safe-area padding, and a spring slide-up.
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-md data-[state=open]:animate-fade-in-sm" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "liquid-glass-strong pb-safe fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl pt-2",
        "data-[state=open]:animate-slide-up focus:outline-none",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className="mx-auto mb-1 mt-1 h-1.5 w-10 shrink-0 rounded-full bg-foreground/20"
      />
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-center text-[15px] font-semibold tracking-tight", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle };
