"use server";

import { revalidatePath } from "next/cache";
import { requireCustomer } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { parseAddress, parseProfile } from "@/lib/phase7/validation.mjs";
import { phase7Messages as messages } from "@/lib/phase7/messages";
import { findOwnedCustomerAddress } from "@/lib/storefront/address-ownership.mjs";

export type AccountState = { error?: string; success?: string };
const text = (formData: FormData, key: string) => typeof formData.get(key) === "string" ? String(formData.get(key)).trim() : "";

export async function updateProfile(_previous: AccountState, data: FormData): Promise<AccountState> {
  let user; try { user = await requireCustomer(); } catch { return { error: messages.ar.loginToAccount }; }
  const parsed = parseProfile(data);
  if (!parsed.ok) return { error: messages.ar.invalidProfile };
  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { name: parsed.value } }),
      prisma.customer.updateMany({ where: { userId: user.id }, data: { name: parsed.value } }),
    ]);
  } catch { return { error: messages.ar.profileSaveFailed }; }
  revalidatePath("/ar/account");
  return { success: messages.ar.profileUpdated };
}

export async function saveAddress(_previous: AccountState, data: FormData): Promise<AccountState> {
  let user; try { user = await requireCustomer(); } catch { return { error: messages.ar.loginToAddresses }; }
  const parsed = parseAddress(data);
  if (!parsed.ok) return { error: messages.ar.addressSaveInvalid };
  const id = text(data, "addressId");
  try {
    await prisma.$transaction(async (tx) => {
      if (id) {
        const owned = await findOwnedCustomerAddress(tx, id, user.id, { id: true });
        if (!owned) throw new Error("not-owned");
      }
      if (parsed.value.isDefault) await tx.customerAddress.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      const addressData = { ...parsed.value };
      if (id) await tx.customerAddress.update({ where: { id }, data: addressData });
      else {
        const [count, defaultCount] = await Promise.all([tx.customerAddress.count({ where: { userId: user.id } }), tx.customerAddress.count({ where: { userId: user.id, isDefault: true } })]);
        await tx.customerAddress.create({ data: { ...addressData, userId: user.id, isDefault: parsed.value.isDefault || count === 0 || defaultCount === 0 } });
      }
    });
  } catch { return { error: messages.ar.addressSaveFailed }; }
  revalidatePath("/ar/account/addresses");
  revalidatePath("/ar/checkout");
  return { success: id ? messages.ar.addressSaved : messages.ar.addressAdded };
}

export async function setDefaultAddress(_previous: AccountState, data: FormData): Promise<AccountState> {
  let user; try { user = await requireCustomer(); } catch { return { error: messages.ar.loginToAddresses }; }
  const id = text(data, "addressId");
  if (!id || id.length > 64) return { error: messages.ar.addressMissing };
  try {
    await prisma.$transaction(async (tx) => {
      const owned = await findOwnedCustomerAddress(tx, id, user.id, { id: true });
      if (!owned) throw new Error("not-owned");
      await tx.customerAddress.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      await tx.customerAddress.update({ where: { id }, data: { isDefault: true } });
    });
  } catch { return { error: messages.ar.defaultFailed }; }
  revalidatePath("/ar/account/addresses");
  revalidatePath("/ar/checkout");
  return { success: messages.ar.defaultSaved };
}

export async function deleteAddress(_previous: AccountState, data: FormData): Promise<AccountState> {
  let user; try { user = await requireCustomer(); } catch { return { error: messages.ar.loginToAddresses }; }
  const id = text(data, "addressId");
  if (!id || id.length > 64) return { error: messages.ar.addressMissing };
  try {
    await prisma.$transaction(async (tx) => {
      const owned = await findOwnedCustomerAddress(tx, id, user.id, { id: true, isDefault: true });
      if (!owned) throw new Error("not-owned");
      await tx.customerAddress.delete({ where: { id } });
      if (owned.isDefault) {
        const next = await tx.customerAddress.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true } });
        if (next) await tx.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
  } catch { return { error: messages.ar.deleteFailed }; }
  revalidatePath("/ar/account/addresses");
  revalidatePath("/ar/checkout");
  return { success: messages.ar.addressDeleted };
}
