"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { adminMessages as messages } from "@/lib/admin/messages";

export default function AdminRouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Admin route failed to render.");
  }, []);
  return <div className="admin-page"><Card className="admin-error-state"><h1>{messages.ar.errorTitle}</h1><p>{messages.ar.errorDescription}</p><div className="admin-page__actions"><Button onClick={reset} variant="primary">{messages.ar.retry}</Button><Link className="ui-button ui-button--outline" href="/admin">{messages.ar.returnDashboard}</Link></div></Card></div>;
}
