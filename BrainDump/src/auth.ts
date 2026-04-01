import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { env } from "@/config/env.server";

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
          }),
        ]
      : []),
    ...(appleEnabled
      ? [
          Apple({
            clientId: appleId,
            clientSecret: appleSecret,
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
      const emailRaw = user.email ?? (profile as { email?: string } | undefined)?.email;
      if (!emailRaw || typeof emailRaw !== "string") {
        return false;
      }
      const email = emailRaw.trim().toLowerCase();
      const name =
        user.name ??
        (profile as { name?: string } | undefined)?.name ??
        ((profile as { given_name?: string; family_name?: string } | undefined)?.given_name
          ? `${(profile as { given_name?: string }).given_name ?? ""} ${(profile as { family_name?: string }).family_name ?? ""}`.trim()
          : null);
      const image =
        user.image ??
        (profile as { picture?: string } | undefined)?.picture ??
        (profile as { image?: string } | undefined)?.image ??
        null;
      await prisma.user.upsert({
        where: { email },
        create: {
          email,
          name: name || null,
          image,
          emailVerified: new Date(),
        },
        update: {
          ...(name ? { name } : {}),
          ...(image != null ? { image } : {}),
        },
      });
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      if (user) {
        if (account?.provider === "google" || account?.provider === "apple") {
          const email = (user.email ?? "").trim().toLowerCase();
          const dbUser = email
            ? await prisma.user.findUnique({
                where: { email },
                select: { id: true, email: true, name: true, image: true },
              })
            : null;
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
