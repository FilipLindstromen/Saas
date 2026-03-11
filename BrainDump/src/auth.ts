import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { env } from "@/config/env.server";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  secret: env.AUTH_SECRET,
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: {
    // Sliding session valid for 30 days (standard web remember-me duration)
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
  },
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        // Expose user id to the client so we can associate records
        (session.user as typeof session.user & { id: string }).id = user.id;
      }
      return session;
    },
  },
});

