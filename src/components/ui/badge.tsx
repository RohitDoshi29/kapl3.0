import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default:
          "border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-yellow-500/15 text-amber-300 font-bold shadow-xs",
        secondary:
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 font-semibold",
        destructive:
          "border-red-500/30 bg-red-500/15 text-red-300 font-semibold",
        outline:
          "border-white/10 bg-white/[0.04] text-muted-foreground backdrop-blur-sm",
        gold:
          "border-amber-400/50 bg-gradient-to-r from-amber-500/30 to-yellow-400/25 text-amber-300 font-black shadow-sm shadow-amber-500/20",
        cyan:
          "border-cyan-500/30 bg-cyan-500/15 text-cyan-300 font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
