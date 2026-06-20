import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-zinc-950 text-white hover:bg-zinc-800",
        secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
        outline: "border border-zinc-200 bg-white hover:bg-zinc-50",
        ghost: "hover:bg-zinc-100"
      },
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2 text-xs",
        icon: "h-9 w-9 px-0"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("rounded-lg border border-zinc-200 bg-white text-zinc-950 shadow-sm", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-zinc-100 p-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-sm font-semibold", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-zinc-500", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700", className)} {...props} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("min-h-80 w-full resize-y rounded-md border border-zinc-200 bg-white p-3 font-mono text-xs leading-5 text-zinc-900 outline-none focus:border-zinc-400", props.className)} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400", props.className)} />;
}

export function Tabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={cn(
            "h-8 rounded px-3 text-sm font-medium text-zinc-500",
            value === tab && "bg-white text-zinc-950 shadow-sm"
          )}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
