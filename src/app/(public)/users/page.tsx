import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Pagination } from "@/app/(public)/_components/pagination";
import { SearchResultCard } from "@/app/(public)/search/_components/search-result-card";
import { AdminIcon } from "@/components/icons";

type UserSearch = {
	id: string;
	name: string;
	slug: string;
	image: string;
	role: string;
	callsign: string;
	location: string;
};

const ITEMS_PER_PAGE = 12;

export default async function Page(props: {
	searchParams: Promise<{ page?: string; }>;
}) {
	const searchParams = await props.searchParams;
	const t = await getTranslations("public.users");
	const page = Number(searchParams.page) || 1;
	const skip = (page - 1) * ITEMS_PER_PAGE;

	const total = await prisma.user.count({
		where: { isPrivate: false },
	});

	const users: UserSearch[] = await prisma.$queryRaw`
		SELECT *
		FROM "User"
		WHERE "isPrivate" = false
		ORDER BY 
			CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
			"createdAt" DESC
		LIMIT ${ITEMS_PER_PAGE}
		OFFSET ${skip}
	`;

	return (
		<div className="container py-8 space-y-8 px-4">
			<h1 className="text-2xl font-bold">{t("title")}</h1>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{users.map((user) => (
					<SearchResultCard
						key={user.id}
						type="user"
						image={user.image}
						title={
							<span className="flex gap-2 items-center">
								{user.name} {user.callsign ? `(${user.callsign})` : ""}
								{user.role === "admin" && <AdminIcon />}
							</span>
						}
						description={null}
						href={`/users/${user.slug ?? user.id}`}
						meta={user.location || undefined}
					/>
				))}
			</div>
			<Pagination
				totalItems={total}
				itemsPerPage={ITEMS_PER_PAGE}
			/>
		</div>
	);
}
