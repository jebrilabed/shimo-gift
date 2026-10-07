import type { HTMLAttributes, PropsWithChildren } from "react";
import { cx } from "./cx";

type BadgeProps = PropsWithChildren<HTMLAttributes<HTMLSpanElement>> & {
  variant?: "success" | "warning" | "error" | "info";
};

export function Badge({ children, className, variant = "info", ...props }: BadgeProps) {
  return <span className={cx("ui-badge", `ui-badge--${variant}`, className)} {...props}>{children}</span>;
}
