"use client";

import { useEffect } from "react";

export function CheckoutAttemptCleanup() {
  useEffect(() => {
    try {
      sessionStorage.removeItem("shimo:checkout-attempt");
      sessionStorage.removeItem("farasha:checkout-attempt");
    } catch {
      // Confirmation remains usable when browser storage is unavailable.
    }
  }, []);
  return null;
}
