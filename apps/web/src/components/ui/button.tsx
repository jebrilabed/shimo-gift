import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  loading?: boolean;
  size?: "small" | "medium" | "large";
  variant?: "primary" | "secondary" | "outline" | "ghost";
};

export function Button({
  children,
  className,
  disabled,
  loading = false,
  size = "medium",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx("ui-button", `ui-button--${variant}`, size !== "medium" && `ui-button--${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      type={type}
      {...props}
    >
      {loading && <span className="ui-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
