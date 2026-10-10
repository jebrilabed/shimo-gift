"use client";

import { lazy, Suspense, useState } from "react";

const StoreAssistantPanel = lazy(() => import("./store-assistant").then((module) => ({ default: module.StoreAssistant })));

export function StoreAssistantLauncher({ locale = "ar" }: { locale?: "ar" | "en" }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasThreads, setHasThreads] = useState(false);
  const isArabic = locale === "ar";

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setLoaded(true);
    setOpen(true);
  }

  return <div className="store-assistant" dir={isArabic ? "rtl" : "ltr"}>
    {loaded && <Suspense fallback={open ? <section className="store-assistant__panel" role="status">{isArabic ? "جاري تحميل المساعد…" : "Loading assistant…"}</section> : null}>
      <StoreAssistantPanel locale={locale} hidden={!open} onClose={() => setOpen(false)} onThreadsAvailable={setHasThreads} />
    </Suspense>}
    <button className="store-assistant__launcher" type="button" aria-expanded={open} onClick={toggle}>
      <span aria-hidden="true">✦</span>{open ? (isArabic ? "إغلاق المساعد" : "Close assistant") : (isArabic ? "مساعدة Shimo Gift" : "Ask Shimo Gift")}
      {hasThreads && <span className="store-assistant__thread-count" aria-label={isArabic ? "لديك محادثة سابقة" : "Previous conversations available"} />}
    </button>
  </div>;
}
