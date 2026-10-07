const addressIdPattern = /^[A-Za-z0-9_-]{1,64}$/;
const userIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

/** Find an address only when it belongs to the server-authenticated user. */
export async function findOwnedCustomerAddress(tx, addressId, userId, select) {
  if (typeof addressId !== "string" || !addressIdPattern.test(addressId) ||
      typeof userId !== "string" || !userIdPattern.test(userId)) return null;

  return tx.customerAddress.findFirst({
    where: { id: addressId, userId },
    ...(select ? { select } : {}),
  });
}
