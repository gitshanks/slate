import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { ensureGoogleProfile } from "@/lib/profiles";
import { SLATE_HOSTED } from "@/lib/public-mode";
import {
  accountOwnerForEmail,
  consumeEmailCode,
  linkAccountEmail,
} from "@/lib/email-auth";

const SESSION_MAX_AGE = 90 * 24 * 60 * 60;

function googleOwnerId(providerAccountId: string) {
  return `google:${providerAccountId}`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Self-hosted installs do not use Auth.js, but Next still imports this module
  // while building route handlers. Give that disabled path a stable local
  // secret; hosted mode intentionally requires AUTH_SECRET.
  secret: process.env.AUTH_SECRET || (SLATE_HOSTED ? undefined : "slate-self-hosted-auth-disabled"),
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      id: "email-code",
      name: "Email code",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", inputMode: "numeric" },
      },
      async authorize(credentials) {
        const ownerId = await consumeEmailCode(credentials.email, credentials.code);
        if (!ownerId || typeof credentials.email !== "string") return null;
        return {
          id: ownerId,
          email: credentials.email.trim().toLowerCase(),
          name: credentials.email.split("@")[0] || "slate viewer",
        };
      },
    }),
    Google({
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === "email-code") {
        return Boolean(user.id && user.email);
      }
      if (account?.provider !== "google" || !account.providerAccountId) {
        return false;
      }

      const email =
        typeof profile?.email === "string" ? profile.email : user.email;
      const verified =
        typeof profile?.email_verified === "boolean"
          ? profile.email_verified
          : true;
      if (!email || !verified) return false;

      const ownerId =
        (await accountOwnerForEmail(email)) ?? googleOwnerId(account.providerAccountId);
      await ensureGoogleProfile({
        id: ownerId,
        email,
        name:
          typeof profile?.name === "string"
            ? profile.name
            : user.name ?? null,
        image:
          typeof profile?.picture === "string"
            ? profile.picture
            : user.image ?? null,
      });
      await linkAccountEmail(email, ownerId);
      user.id = ownerId;
      return true;
    },
    async jwt({ token, account, user }) {
      if (account && user?.id) {
        token.userId = user.id;
      } else if (account?.provider === "google" && account.providerAccountId) {
        token.userId = googleOwnerId(account.providerAccountId);
      }
      if (!token.emailAccountLinked && token.userId && token.email) {
        try {
          await linkAccountEmail(token.email, token.userId);
          token.emailAccountLinked = true;
        } catch {
          // Account linking is additive. A temporary email/DB failure must not
          // invalidate an otherwise healthy Google session.
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string") {
        session.user.id = token.userId;
      }
      return session;
    },
  },
});
