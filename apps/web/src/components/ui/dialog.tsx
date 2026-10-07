"use client";

import { useId, useRef, type ReactNode } from "react";
import { Button } from "./button";

type DialogProps = {
  children: ReactNode;
  description: string;
  label: string;
  title: string;
};

export function Dialog({ children, description, label, title }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <>
      <Button variant="outline" onClick={() => dialogRef.current?.showModal()}>
        {label}
      </Button>
      <dialog
        ref={dialogRef}
        className="ui-dialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="ui-dialog__content">
          <h3 id={titleId}>{title}</h3>
          <p id={descriptionId}>{description}</p>
          {children}
          <form method="dialog" className="ui-dialog__actions">
            <Button type="submit" variant="primary">إغلاق النافذة</Button>
          </form>
        </div>
      </dialog>
    </>
  );
}
