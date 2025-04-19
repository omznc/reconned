import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Pagination } from "@/app/[locale]/(public)/_components/pagination";
import { SearchResultCard } from "@/app/[locale]/(public)/search/_components/search-result-card";
import { VerifiedClubIcon } from "@/components/icons";

const ITEMS_PER_PAGE = 12;

type ClubSearch = {
	id: string;
	name: string;
	slug: string;
	description: string;
	logo: string;
	verified: boolean;
	location: string;
	member_count: number;
};

export default async function Page(props: {
	searchParams: Promise<{ page?: string }>;
}) {
	const searchParams = await props.searchParams;
	const t = await getTranslations("public.clubs");
	const page = Number(searchParams.page) || 1;
	const skip = (page - 1) * ITEMS_PER_PAGE;

	const total = await prisma.club.count({
		where: { isPrivate: false },
	});

	const clubs: ClubSearch[] = await prisma.$queryRaw`
		SELECT c.id, c.name, c.slug, c.description, c.logo, c.verified, c.location, COUNT(cm.id) as member_count
		FROM "Club" c
		LEFT JOIN "ClubMembership" cm ON c.id = cm."clubId"
		WHERE c."isPrivate" = false
		GROUP BY c.id
		ORDER BY 
			c.verified DESC,
			COUNT(cm.id) DESC
		LIMIT ${ITEMS_PER_PAGE}
		OFFSET ${skip}
	`;

	return (
		<div className="container max-w-4xl py-8 space-y-8 px-4">
			<h1 className="text-2xl font-bold">{t("title")}</h1>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{clubs.map((club) => (
					<SearchResultCard
						key={club.id}
						type="club"
						image={club.logo}
						title={
							<span className="flex gap-2 items-center">
								{club.name} {club.verified && <VerifiedClubIcon />}
							</span>
						}
						description={club.description}
						href={`/clubs/${club.slug ?? club.id}`}
						badges={[`${club.member_count} ${club.member_count === 1 ? "član" : "članova"}`]}
						meta={club.location || undefined}
					/>
				))}
			</div>
			<Pagination totalItems={total} itemsPerPage={ITEMS_PER_PAGE} />
		</div>
	);
}
