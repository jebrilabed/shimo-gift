"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { recoverCheckoutAttemptAction } from "@/app/[locale]/(store)/actions";

export function CheckoutRecovery() {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    try {
      const stored = sessionStorage.getItem("farasha:checkout-attempt");
      const attempt = stored ? JSON.parse(stored) as { token?: unknown } : null;
      if (typeof attempt?.token === "string") {
        void recoverCheckoutAttemptAction(attempt.token).then((orderNumber) => {
          if (active && orderNumber) router.replace(`/ar/order-confirmation/${orderNumber}`);
        });
      }
    } catch {
      // The empty-cart state remains available if browser storage is disabled.
    }
    return () => { active = false; };
  }, [router]);
  return null;
}
