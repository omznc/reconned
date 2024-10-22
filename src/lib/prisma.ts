import "server-only";

import { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client/extension";

const prismaClientSingleton = () => {
	return new PrismaClient().$extends({
		model: {
			$allModels: {
				async exists<T>(this: T, where: Prisma.Args<T, "findFirst">["where"]): Promise<boolean> {
					const context = Prisma.getExtensionContext(this);

					// biome-ignore lint/suspicious/noExplicitAny: Prisma stuff
					const result = await (context as any).findFirst({ where });
					return result !== null;
				},
				findManyAndCount<Model, Args>(
					this: Model,
					args: Prisma.Exact<Args, Prisma.Args<Model, "findMany">>,
				): Promise<
					[Prisma.Result<Model, Args, "findMany">, number, Args extends { take: number } ? number : undefined]
				> {
					return prisma.$transaction([
						// biome-ignore lint/suspicious/noExplicitAny: <explanation>
						(this as any).findMany(args),
						// biome-ignore lint/suspicious/noExplicitAny: <explanation>
						(this as any).count({ where: (args as any).where }),
						// biome-ignore lint/suspicious/noExplicitAny: <explanation>
					]) as any;
				},
			},
		},
	});
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

/*global globalThis*/
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
