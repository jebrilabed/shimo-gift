export function createCurrentUserReader(getSession, findUser) {
  return async function getCurrentUser() {
    const session = await getSession();
    const userId = session?.user?.id;
    if (typeof userId !== "string" || userId.length === 0) return null;
    return findUser(userId);
  };
}
