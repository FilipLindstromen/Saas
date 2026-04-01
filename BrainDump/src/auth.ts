import NextAuth from "next-auth";
import type { User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { env } from "@/config/env.server";

/**
 * Email for OAuth signIn/jwt: user is normalized by Auth.js, but profile still has
 * the OIDC claims if user.email is missing (and Apple may nest email under profile.user).
 */
function resolveOAuthEmail(user: User, profile: unknown): string | null {
  const fromUser = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (fromUser) return fromUser;
  const p = profile as Record<string, unknown> | null | undefined;
  if (p && typeof p.email === "string" && p.email.trim()) {
    return p.email.trim().toLowerCase();
  }
  if (p?.user && typeof p.user === "object" && p.user !== null) {
    const nested = (p.user as { email?: string }).email;
    if (typeof nested === "string" && nested.trim()) return nested.trim().toLowerCase();
  }
  return null;
}

type OidcProfile = {
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  image?: string;
};

function oauthNameAndImage(user: User, profile: unknown): { name: string | null; image: string | null } {
  const p = profile as OidcProfile | undefined;
  const name =
    user.name ??
    p?.name ??
    (p?.given_name ? `${p.given_name ?? ""} ${p.family_name ?? ""}`.trim() : null);
  const image = user.image ?? p?.picture ?? p?.image ?? null;
  return { name: name || null, image };
}

async function upsertOAuthUserRecord(email: string, name: string | null, image: string | null): Promise<void> {
  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      image,
      emailVerified: new Date(),
      clientPreferences: {},
    },
    update: {
      ...(name ? { name } : {}),
      ...(image != null ? { image } : {}),
      emailVerified: new Date(),
    },
  });
}

const googleId = env.GOOGLE_CLIENT_ID.trim();
const googleSecret = env.GOOGLE_CLIENT_SECRET.trim();
const googleEnabled = googleId.length > 0 && googleSecret.length > 0;

const appleId = env.AUTH_APPLE_ID.trim();
const appleSecret = env.AUTH_APPLE_SECRET.trim();
const appleEnabled = appleId.length > 0 && appleSecret.length > 0;

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  secret: env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days; "remember me" can extend this
  },
  providers: [
    ...(googleEnabled
      ? [
          Google({
            clientId: googleId,
            clientSecret: googleSecret,
            authorization: {
              params: {
                scope: "openid email profile",
              },
            },
            /** Trust Google-verified email so “already registered with password” + Google same address works without adapter linking errors. */
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(appleEnabled
      ? [
          Apple({
            clientId: appleId,
            clientSecret: appleSecret,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember me", type: "checkbox" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);
        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user?.passwordHash) return null;
        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" && account?.provider !== "apple") {
        return true;
      }
      const email = resolveOAuthEmail(user, profile);
      if (!email) {
        console.error(
          "[BrainDump] OAuth sign-in rejected: missing email from provider.",
          account?.provider
        );
        return false;
      }

      const { name, image } = oauthNameAndImage(user, profile);

      try {
        await upsertOAuthUserRecord(email, name, image);
      } catch (e) {
        console.error("[BrainDump] OAuth user upsert failed:", e);
        return false;
      }
      return true;
    },
    async jwt({ token, user, account, profile, trigger }) {
      if (user) {
        if (account?.provider === "google" || account?.provider === "apple") {
          const email = resolveOAuthEmail(user, profile) ?? "";
          let dbUser = email
            ? await prisma.user.findUnique({
                where: { email },
                select: { id: true, email: true, name: true, image: true },
              })
            : null;
          if (!dbUser && email) {
            try {
              const { name, image } = oauthNameAndImage(user, profile);
              await upsertOAuthUserRecord(email, name, image);
              dbUser = await prisma.user.findUnique({
                where: { email },
                select: { id: true, email: true, name: true, image: true },
              });
            } catch (e) {
              console.error("[BrainDump] JWT OAuth user repair upsert failed:", e);
            }
          }
          if (dbUser) {
            token.id = dbUser.id;
            token.email = dbUser.email;
            token.name = dbUser.name;
            token.picture = dbUser.image ?? null;
          } else if (trigger === "signIn" || trigger === "signUp") {
            console.error(
              "[BrainDump] JWT: no DB user after OAuth sign-in for email:",
              email || "(empty)"
            );
          }
        } else {
          token.id = user.id;
          token.email = user.email;
          token.name = user.name;
          token.picture = user.image ?? null;
        }
      }
      if (trigger === "update" && token.id) {
        const u = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, email: true, image: true },
        });
        if (u) {
          token.name = u.name;
          token.email = u.email;
          token.picture = u.image;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as typeof session.user & { id: string }).id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = (token.picture as string | null | undefined) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
