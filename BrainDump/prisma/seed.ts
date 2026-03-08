import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Optional: create a sample project for demo
  const existing = await prisma.project.findFirst();
  if (!existing) {
    await prisma.project.create({
      data: { name: "Sample Project", domain: "work", status: "active" },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
