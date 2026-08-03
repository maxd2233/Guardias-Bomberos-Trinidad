import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const baseClasses =
  "inline-flex min-h-11 cursor-pointer select-none items-center justify-center gap-2 rounded-[10px] whitespace-nowrap font-semibold leading-none transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-fire text-surface hover:bg-fire-dark active:bg-fire-dark",
  secondary:
    "border border-ink/40 bg-surface text-ink hover:bg-ink/5 active:bg-ink/10",
  ghost: "bg-transparent text-ink hover:bg-ink/5 active:bg-ink/10",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[17px]",
  md: "h-11 px-5 text-[17px]",
  lg: "h-12 px-6 text-[17px]",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  );
}
