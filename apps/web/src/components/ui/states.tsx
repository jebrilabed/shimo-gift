import { useId, type ReactNode } from "react";
import { cx } from "./cx";

type MessageStateProps = {
  action?: ReactNode;
  className?: string;
  description: string;
  title: string;
};

export function LoadingState({
  announce = true,
  label = "جاري التحميل",
  lines = 2,
}: { announce?: boolean; label?: string; lines?: number }) {
  return (
    <div className="ui-loading" role={announce ? "status" : undefined} aria-live={announce ? "polite" : "off"}>
      <span>{label}</span>
      <div className="ui-loading__skeletons" aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span key={index} className="ui-skeleton" style={{ inlineSize: index === 0 ? "72%" : "48%" }} />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ action, className, description, title }: MessageStateProps) {
  const titleId = useId();

  return (
    <section className={cx("ui-state", className)} aria-labelledby={titleId}>
      <span className="ui-state__symbol" aria-hidden="true">○</span>
      <h3 id={titleId}>{title}</h3>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function ErrorState({ action, announce = true, className, description, title }: MessageStateProps & { announce?: boolean }) {
  const titleId = useId();

  return (
    <section className={cx("ui-state ui-state--error", className)} role={announce ? "alert" : undefined} aria-labelledby={titleId}>
      <span className="ui-state__symbol" aria-hidden="true">!</span>
      <h3 id={titleId}>{title}</h3>
      <p>{description}</p>
      {action}
    </section>
  );
}
