import { PrismaPg } from "@prisma/adapter-pg";
import "server-only";
import { PrismaClient } from "@generated/client";
import { env } from "./env";

const prismaClientSingleton = () => {
	const adapter = new PrismaPg({
		connectionString: env.DATABASE_URL,
	});
	return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

/*global globalThis*/
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();
if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}
