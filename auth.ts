import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { ensureGoogleProfile } from "@/lib/profiles";
import { SLATE_HOSTED } from "@/lib/public-mode";

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

      await ensureGoogleProfile({
        id: googleOwnerId(account.providerAccountId),
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
      return true;
    },
    async jwt({ token, account }) {
      if (account?.provider === "google" && account.providerAccountId) {
        token.userId = googleOwnerId(account.providerAccountId);
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
