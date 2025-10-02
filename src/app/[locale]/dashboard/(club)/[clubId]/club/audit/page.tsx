import { Role } from "@generated/client";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuditLogsTable } from "@/app/[locale]/dashboard/(club)/[clubId]/club/audit/_components/audit-logs-table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("dashboard.club.audit.pageTitle"),
	};
}

async function AuditLogsPageFetcher(props: PageProps<"/[locale]/dashboard/[clubId]/club/audit">) {
	const { params, searchParams } = props;
	const { clubId } = await params;
	const { search, sortBy, sortOrder, page, perPage, actionType } = await searchParams;

	// Parse pagination parameters
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	// Check user authentication and permissions
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	// Check if the user is a manager or owner of the club
	const membership = await prisma.clubMembership.findFirst({
		where: {
			clubId,
			userId: user.id,
			role: {
				in: [Role.CLUB_OWNER, Role.MANAGER],
			},
		},
	});

	if (!membership) {
		return notFound();
	}

	// Build the query for fetching audit logs
	const where = {
		clubId,
		...(search
			? {
					OR: [
						{ actionType: { contains: search as string, mode: "insensitive" as const } },
						{ user: { name: { contains: search as string, mode: "insensitive" as const } } },
						{ user: { email: { contains: search as string, mode: "insensitive" as const } } },
						{ ipAddress: { contains: search as string, mode: "insensitive" as const } },
					],
				}
			: {}),
		...(actionType && actionType !== "all"
			? {
					actionType: actionType as string,
				}
			: {}),
	};

	const orderBy = sortBy
		? ({
				[sortBy as string]: sortOrder ?? "desc",
			} as const)
		: ({ createdAt: "desc" } as const);

	// Fetch audit logs with pagination
	const [totalLogs, logs] = await Promise.all([
		prisma.clubAuditLog.count({ where }),
		prisma.clubAuditLog.findMany({
			where,
			orderBy,
			take: pageSize,
			skip: (currentPage - 1) * pageSize,
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
		}),
	]);

	return <AuditLogsTable logs={logs} totalLogs={totalLogs} pageSize={pageSize} />;
}

export default async function AuditLogsPage(props: PageProps<"/[locale]/dashboard/[clubId]/club/audit">) {
	const t = await getTranslations();
	const [_, searchParams] = await Promise.all([props.params, props.searchParams]);

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-3xl font-bold tracking-tight">{t("dashboard.club.audit.pageTitle")}</h2>
				<p className="text-muted-foreground">{t("dashboard.club.audit.pageDescription")}</p>
			</div>

			<Suspense key={JSON.stringify(searchParams)} fallback={<GenericDataTableSkeleton />}>
				<AuditLogsPageFetcher {...props} />
			</Suspense>
		</div>
	);
}
