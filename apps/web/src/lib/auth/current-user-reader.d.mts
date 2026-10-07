export interface SessionIdentity {
  user?: { id?: string | null } | null;
}
export function createCurrentUserReader<TUser extends { id: string }>(
  getSession: () => Promise<SessionIdentity | null>,
  findUser: (userId: string) => Promise<TUser | null>,
): () => Promise<TUser | null>;
