import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";

type FieldProps = {
  className?: string;
  error?: string;
  hint?: string;
  label: string;
};

type SharedControlProps = FieldProps & { id?: string };

function FieldSupport({ id, hint, error }: Pick<SharedControlProps, "id" | "hint" | "error">) {
  return (
    <>
      {hint && !error && <span className="ui-field__hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="ui-field__error" id={`${id}-error`}>{error}</span>}
    </>
  );
}

function describedBy(id: string, hint?: string, error?: string, existing?: string) {
  return [existing, error ? `${id}-error` : hint ? `${id}-hint` : undefined].filter(Boolean).join(" ") || undefined;
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & SharedControlProps;

export function Input({ className, error, hint, id: suppliedId, label, ...props }: InputProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const supportId = describedBy(id, hint, error, props["aria-describedby"]);

  return (
    <label className={cx("ui-field", className)} htmlFor={id}>
      <span className="ui-field__label">{label}</span>
      <input
        {...props}
        id={id}
        className="ui-field__control"
        aria-invalid={error ? true : undefined}
        aria-describedby={supportId}
      />
      <FieldSupport id={id} hint={hint} error={error} />
    </label>
  );
}

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & SharedControlProps;

export function Textarea({ className, error, hint, id: suppliedId, label, ...props }: TextareaProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;

  return (
    <label className={cx("ui-field", className)} htmlFor={id}>
      <span className="ui-field__label">{label}</span>
      <textarea
        {...props}
        id={id}
        className="ui-field__control"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error, props["aria-describedby"])}
      />
      <FieldSupport id={id} hint={hint} error={error} />
    </label>
  );
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & SharedControlProps & {
  children: ReactNode;
};

export function Select({ children, className, error, hint, id: suppliedId, label, ...props }: SelectProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;

  return (
    <label className={cx("ui-field", className)} htmlFor={id}>
      <span className="ui-field__label">{label}</span>
      <select
        {...props}
        id={id}
        className="ui-field__control"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error, props["aria-describedby"])}
      >
        {children}
      </select>
      <FieldSupport id={id} hint={hint} error={error} />
    </label>
  );
}
