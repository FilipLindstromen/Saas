import { PrismaClient } from "./generated/prisma/client";

const url = process.env.DATABASE_URL;
const prisma = new PrismaClient({
  ...(url ? { datasources: { db: { url } } } : {}),
});

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("No user found. Sign in once to create a user, then run seed again.");
    return;
  }
  const existing = await prisma.project.findFirst({ where: { userId: user.id } });
  if (!existing) {
    await prisma.project.create({
      data: {
        name: "Sample Project",
        domain: "work",
        status: "active",
        userId: user.id,
      },
    });
    console.log("Created Sample Project for user:", user.id);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
