"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Input, Textarea } from "@/components/ui";
import { storefrontMessages as messages } from "@/lib/storefront/messages";
import { submitCheckoutAction, type CheckoutActionState } from "@/app/[locale]/(store)/actions";
import { phase7Messages as phase7 } from "@/lib/phase7/messages";

const initialState: CheckoutActionState = {};

export function CheckoutForm({
  addresses = [],
  defaultAddressId = "",
  checkoutToken,
  quoteFingerprint,
  checkoutExpiresAt,
  contactName,
  contactPhone,
}: {
  addresses?: { id: string; label: string }[];
  defaultAddressId?: string;
  checkoutToken: string;
  quoteFingerprint: string;
  checkoutExpiresAt: number;
  contactName: string;
  contactPhone: string;
}) {
  const [addressId, setAddressId] = useState(defaultAddressId);
  const [activeCheckoutToken, setActiveCheckoutToken] = useState(checkoutToken);
  const [state, action, pending] = useActionState(submitCheckoutAction, initialState);
  useEffect(() => {
    const storageKey = "shimo:checkout-attempt";
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const attempt = JSON.parse(stored) as { fingerprint?: unknown; token?: unknown; expiresAt?: unknown };
        if (attempt.fingerprint === quoteFingerprint && typeof attempt.token === "string" &&
          typeof attempt.expiresAt === "number" && attempt.expiresAt > Date.now()) {
          setActiveCheckoutToken(attempt.token);
          return;
        }
      }
      sessionStorage.setItem(storageKey, JSON.stringify({ fingerprint: quoteFingerprint, token: checkoutToken, expiresAt: checkoutExpiresAt }));
    } catch {
      // The signed token in the form remains the server-issued fallback.
    }
  }, [checkoutExpiresAt, checkoutToken, quoteFingerprint]);
  const values = state.values;
  const fieldError = (key: string) => state.fieldErrors?.[key]
    ? messages.ar[state.fieldErrors[key] as keyof typeof messages.ar]
    : undefined;

  return (
    <form action={action} className="store-form">
      <input name="checkoutToken" type="hidden" value={activeCheckoutToken} />
      {addresses.length > 0 && <label className="ui-field"><span className="ui-field__label">{phase7.ar.savedAddress}</span><select className="ui-field__control" name="addressId" value={addressId} onChange={(event) => setAddressId(event.target.value)}><option value="">{phase7.ar.enterOtherAddress}</option>{addresses.map((address) => <option key={address.id} value={address.id}>{address.label}</option>)}</select></label>}
      {!addressId && <>
      <Input autoComplete="name" defaultValue={values?.contactName ?? contactName} label={messages.ar.contactName} maxLength={200} name="contactName" required error={fieldError("contactName")} />
      <Input autoComplete="tel" dir="ltr" defaultValue={values?.contactPhone ?? contactPhone} label={messages.ar.phone} maxLength={40} name="contactPhone" required error={fieldError("contactPhone")} />
      <Input autoComplete="street-address" defaultValue={values?.address} label={messages.ar.address} maxLength={500} name="address" required error={fieldError("address")} />
      <Input autoComplete="address-level2" defaultValue={values?.city} label={messages.ar.city} maxLength={120} name="city" required error={fieldError("city")} />
      </>}
      <Textarea defaultValue={values?.customerNote} label={messages.ar.note} maxLength={2000} name="customerNote" rows={4} error={fieldError("customerNote")} />
      {state.error && <p className="store-alert store-alert--error" role="alert">{state.error}</p>}
      {(state.error === messages.ar.checkoutCartChanged || state.error === messages.ar.stockChanged || state.error === messages.ar.cartInvalid) && <Link href="/ar/cart">{messages.ar.reviewCart}</Link>}
      <Button loading={pending} type="submit">{messages.ar.placeOrder}</Button>
    </form>
  );
}
