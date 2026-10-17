import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-wide ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none cursor-pointer [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-slate-950 font-bold shadow-md shadow-amber-500/25 hover:shadow-lg hover:shadow-amber-500/40 hover:brightness-105 border border-amber-300/40",
        destructive:
          "bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold shadow-md shadow-red-600/25 hover:shadow-lg hover:shadow-red-600/40 hover:brightness-105 border border-red-400/30",
        outline:
          "border border-border/80 bg-card/60 backdrop-blur-md text-foreground hover:bg-white/[0.08] hover:border-primary/50 hover:text-primary shadow-xs",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold shadow-xs hover:shadow-sm hover:shadow-emerald-500/20 border border-emerald-500/20",
        ghost:
          "hover:bg-white/[0.08] hover:text-foreground text-muted-foreground",
        link:
          "text-primary underline-offset-4 hover:underline font-semibold",
        glow:
          "bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black tracking-wide shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:brightness-110 border border-emerald-300/50",
        stadium:
          "bg-slate-900/90 border border-amber-500/40 text-amber-400 hover:bg-amber-500/15 hover:border-amber-400 font-bold shadow-sm shadow-black/40",
        neon:
          "bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold shadow-md shadow-cyan-500/25 hover:shadow-lg hover:shadow-cyan-500/40 hover:brightness-110 border border-cyan-300/40",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8.5 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-7 text-base font-bold",
        xl: "h-14 rounded-2xl px-8 text-lg font-black",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
