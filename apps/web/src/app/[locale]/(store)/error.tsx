"use client";

import { Button, Container } from "@/components/ui";
import { storefrontMessages as messages } from "@/lib/storefront/messages";

export default function StoreError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="store-main"><Container width="reading"><div className="ui-state ui-state--error"><span className="ui-state__symbol" aria-hidden="true">!</span><h1>{messages.ar.genericError}</h1><Button onClick={reset}>{messages.ar.retry}</Button></div></Container></main>;
}
