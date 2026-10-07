import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import NextAuth, { AuthError } from "next-auth";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password-hash.mjs";

let dummyPasswordHash: Promise<string> | undefined;

function getDummyPasswordHash() {
  dummyPasswordHash ??= hashPassword(`${randomUUID()}${randomUUID()}`);
  return dummyPasswordHash;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  // The app is self-hosted; its ingress must validate incoming Host headers.
  trustHost: true,
  pages: {
    signIn: "/ar/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials.password === "string" ? credentials.password : "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return null;
        if (password.length < 8 || password.length > 128) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, role: true, passwordHash: true },
        });
        const passwordHash = user?.passwordHash ?? await getDummyPasswordHash();
        const validPassword = await verifyPassword(password, passwordHash);

        if (!user || !user.passwordHash || !validPassword || !user.email) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role === "ADMIN" ? "ADMIN" : "CUSTOMER";
      }
      return session;
    },
  },
  logger: {
    error(error) {
      if (error instanceof AuthError) {
        // AuthError types are safe to record and identify configuration failures
        // without logging credentials or request payloads.
        console.error(`Auth.js request failed (${error.type}).`);
        return;
      }
      // Do not log authentication payloads, credentials, or provider internals.
      console.error("Auth.js request failed.");
    },
  },
});
