import { AddPurchaseModal } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/spending.form";
import { PurchasesTable } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/purchases-table";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { FEATURE_FLAGS } from "@/lib/server-utils";
import { ErrorPage } from "@/components/error-page";
import { getTranslations } from "next-intl/server";

interface PageProps {
	params: Promise<{ clubId: string; }>;
	searchParams: Promise<{
		search?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		page?: string;
		perPage?: string;
	}>;
}

export default async function SpendingPage(props: PageProps) {
	const t = await getTranslations("dashboard.club.spending");

	if (!FEATURE_FLAGS.CLUBS_SPENDING) {
		return <ErrorPage title={t("title")} />;
	}
	const { clubId } = await props.params;
	const { search, sortBy, sortOrder, page, perPage } = await props.searchParams;

	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize =
		perPage === "25" || perPage === "50" || perPage === "100"
			? Number(perPage)
			: 25;

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
	} satisfies Prisma.ClubPurchaseWhereInput;

	const orderBy: Prisma.ClubPurchaseOrderByWithRelationInput = sortBy
		? {
			[sortBy]: sortOrder ?? "asc",
		}
		: { createdAt: "desc" };

	const purchases = await prisma.clubPurchase.findMany({
		where,
		orderBy,
		take: pageSize,
		skip: (currentPage - 1) * pageSize,
	});

	const totalPurchases = await prisma.clubPurchase.count({ where });

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">{t("title")}</h3>
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
