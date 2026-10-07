export function hashPassword(password: string): Promise<string>;
export function verifyPassword(password: string, encodedHash: string | null | undefined): Promise<boolean>;
