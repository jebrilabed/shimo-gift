export function findOwnedCustomerAddress<T = { id: string }>(
  tx: { customerAddress: { findFirst(args: { where: { id: string; userId: string }; select?: object }): Promise<T | null> } },
  addressId: string,
  userId: string,
  select?: object,
): Promise<T | null>;
