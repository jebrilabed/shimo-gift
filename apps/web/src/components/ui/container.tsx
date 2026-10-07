import type { PropsWithChildren } from "react";
import { cx } from "./cx";

type ContainerProps = PropsWithChildren<{
  className?: string;
  width?: "page" | "reading";
}>;

export function Container({ children, className, width = "page" }: ContainerProps) {
  return <div className={cx(width === "reading" ? "reading-container" : "page-container", className)}>{children}</div>;
}
