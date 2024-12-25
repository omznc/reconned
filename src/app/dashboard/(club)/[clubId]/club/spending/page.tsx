import { AddPurchaseModal } from "@/app/dashboard/(club)/[clubId]/club/spending/_components/spending.form";
import { PurchasesTable } from "@/app/dashboard/(club)/[clubId]/club/spending/_components/purchases-table";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

interface PageProps {
	params: Promise<{ clubId: string }>;
	searchParams: Promise<{
		search?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		page?: string;
	}>;
}

export default async function SpendingPage(props: PageProps) {
	const { clubId } = await props.params;
	const { search, sortBy, sortOrder, page } = await props.searchParams;

	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = 10;

	const where = {
		clubId,
		...(search
			? {
					OR: [
						{ title: { contains: search, mode: "insensitive" } },
						{ description: { contains: search, mode: "insensitive" } },
					],
				}
			: {}),
	} satisfies Prisma.PurchasesWhereInput;

	const orderBy: Prisma.PurchasesOrderByWithRelationInput = sortBy
		? {
				[sortBy]: sortOrder ?? "asc",
			}
		: { createdAt: "desc" };

	const purchases = await prisma.purchases.findMany({
		where,
		orderBy,
		take: pageSize,
		skip: (currentPage - 1) * pageSize,
	});

	const totalPurchases = await prisma.purchases.count({ where });

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">Potrošnja</h3>
				<AddPurchaseModal />
			</div>

			<PurchasesTable
				purchases={purchases}
				totalPurchases={totalPurchases}
				pageSize={pageSize}
			/>
		</div>
	);
}
