import type { PropsWithChildren, ReactNode } from "react";

type DropdownProps = PropsWithChildren<{ label: string; trigger?: ReactNode }>;

export function Dropdown({ children, label, trigger }: DropdownProps) {
  return (
    <details className="ui-dropdown">
      <summary className="ui-dropdown__trigger">
        {trigger ?? label}
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="ui-dropdown__menu" role="group" aria-label={label}>{children}</div>
    </details>
  );
}
