import NextAuth from "next-auth";
import type { User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

// ─── OAuth helpers (mirrors BrainDump pattern) ────────────────────────────────

function resolveOAuthEmail(user: User, profile: unknown): string | null {
  const fromUser = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (fromUser) return fromUser;
  const p = profile as Record<string, unknown> | null | undefined;
  if (p && typeof p.email === "string" && p.email.trim()) {
    return p.email.trim().toLowerCase();
  }
  return null;
}

type OidcProfile = {
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

function oauthNameAndImage(
  user: User,
  profile: unknown,
): { name: string | null; image: string | null } {
  const p = profile as OidcProfile | undefined;
  const name =
    user.name ??
    p?.name ??
    (p?.given_name ? `${p.given_name ?? ""} ${p.family_name ?? ""}`.trim() : null);
  const image = user.image ?? p?.picture ?? null;
  return { name: name || null, image };
}

async function upsertOAuthUser(
  email: string,
  name: string | null,
  image: string | null,
) {
  await prisma.user.upsert({
    where: { email },
    create: { email, name, image, emailVerified: new Date() },
    update: {
      ...(name ? { name } : {}),
      ...(image != null ? { image } : {}),
      emailVerified: new Date(),
    },
  });
}

// ─── Google provider (only if env vars are present) ──────────────────────────

const googleClientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
const googleClientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
const googleEnabled = googleClientId.length > 0 && googleClientSecret.length > 0;

// ─── NextAuth config ──────────────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    ...(googleEnabled
      ? [
          Google({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            authorization: { params: { scope: "openid email profile" } },
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).trim().toLowerCase();

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, passwordHash: true },
        });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(String(credentials.password), user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;

      const email = resolveOAuthEmail(user, profile);
      if (!email) return false;

      const { name, image } = oauthNameAndImage(user, profile);
      try {
        await upsertOAuthUser(email, name, image);
      } catch (e) {
        console.error("[MetaConnect] Google sign-in upsert failed:", e);
        return false;
      }
      return true;
    },

    async jwt({ token, user, account, profile, trigger }) {
      if (user) {
        if (account?.provider === "google") {
          const email = resolveOAuthEmail(user, profile) ?? "";
          let dbUser = email
            ? await prisma.user.findUnique({
                where: { email },
                select: { id: true, email: true, name: true, image: true },
              })
            : null;

          if (!dbUser && email) {
            const { name, image } = oauthNameAndImage(user, profile);
            await upsertOAuthUser(email, name, image);
            dbUser = await prisma.user.findUnique({
              where: { email },
              select: { id: true, email: true, name: true, image: true },
            });
          }

          if (dbUser) {
            token.id = dbUser.id;
            token.email = dbUser.email;
            token.name = dbUser.name;
            token.picture = dbUser.image ?? null;
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
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = (token.picture as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});
