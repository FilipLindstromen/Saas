import { PrismaClient } from "./generated/prisma/client";

const url = process.env.DATABASE_URL;
const options: { datasources?: { db: { url: string } } } = url
  ? { datasources: { db: { url } } }
  : {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma 7 constructor type is strict; options are valid at runtime
const prisma = new PrismaClient(options as any);

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
