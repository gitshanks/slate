import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Apple from "next-auth/providers/apple";
import Google from "next-auth/providers/google";
import { appleClientCredentials } from "@/lib/apple-auth";
import { ensureGoogleProfile, getProfileById } from "@/lib/profiles";
import { belongsToAccount } from "@/lib/account-session";
import { resolveNativeOwner } from "@/lib/native-api/account";
import { SLATE_HOSTED } from "@/lib/public-mode";
import {
  accountOwnerForEmail,
  consumeEmailCode,
  linkAccountEmail,
} from "@/lib/email-auth";

const SESSION_MAX_AGE = 90 * 24 * 60 * 60;
const appleCredentials = appleClientCredentials();

// Apple returns to the callback with a cross-site form POST, which drops the
// default SameSite=Lax check cookies. Only the short-lived OAuth check cookies
// are relaxed; the session cookie keeps Auth.js defaults.
const crossSiteCheckCookie = (name: string) => ({
  name: `__Secure-authjs.${name}`,
  options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true },
});

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
    ...(appleCredentials ? [Apple(appleCredentials)] : []),
  ],
  cookies: appleCredentials
    ? {
        state: crossSiteCheckCookie("state"),
        nonce: crossSiteCheckCookie("nonce"),
        pkceCodeVerifier: crossSiteCheckCookie("pkce.code_verifier"),
      }
    : undefined,
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === "email-code") {
        return Boolean(user.id && user.email);
      }
      if (account?.provider === "apple" && account.providerAccountId) {
        // Same identity table as the iOS app, so one Apple ID is one slate
        // on the web and on iPhone.
        const email = typeof profile?.email === "string" ? profile.email : null;
        // Apple sends email_verified as a boolean or as the string "true".
        const emailVerified = String(profile?.email_verified) === "true";
        user.id = await resolveNativeOwner({
          provider: "apple",
          subject: account.providerAccountId,
          email,
          emailVerified,
          name: user.name && user.name !== email ? user.name : null,
          avatarUrl: null,
        });
        return true;
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
      if (SLATE_HOSTED) {
        if (!token.userId) return null;
        const currentProfile = await getProfileById(token.userId);
        if (!currentProfile) return null;
        // Only an actual sign-in can bind a cookie to a new account. Merely
        // refreshing an old cookie must never restore a deleted identity.
        if (!account && !belongsToAccount(token, currentProfile.created_at)) return null;
        token.accountCreatedAt = currentProfile.created_at;
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
