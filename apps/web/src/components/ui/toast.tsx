"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type ToastTone = "success" | "warning" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };
type ToastDispatcher = (message: string, tone: ToastTone) => void;

const ToastContext = createContext<ToastDispatcher>(() => {});

const toastTitle: Record<ToastTone, string> = {
  success: "تم بنجاح",
  warning: "تنبيه",
  error: "حدث خطأ",
  info: "معلومة",
};

const toastIcon: Record<ToastTone, string> = {
  success: "✓",
  warning: "!",
  error: "×",
  info: "i",
};

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.tone === "error" ? 7000 : 5000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast.id, toast.tone]);

  return (
    <div className={`ui-toast ui-toast--${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>
      <span aria-hidden="true" className="ui-toast__icon">{toastIcon[toast.tone]}</span>
      <div className="ui-toast__content">
        <strong>{toastTitle[toast.tone]}</strong>
        <p>{toast.message}</p>
      </div>
      <button aria-label="إغلاق التنبيه" className="ui-toast__close" onClick={() => onDismiss(toast.id)} type="button">×</button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const notify = useCallback<ToastDispatcher>((message, tone) => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { id, message, tone }].slice(-4));
  }, []);
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div aria-label="التنبيهات" className="ui-toast-viewport" role="region">
        {toasts.map((toast) => <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function ToastMessage({ message, tone = "info", eventKey }: { message?: string | null; tone?: ToastTone; eventKey?: unknown }) {
  const notify = useContext(ToastContext);
  useEffect(() => {
    if (message) notify(message, tone);
  }, [eventKey, message, notify, tone]);
  return null;
}
