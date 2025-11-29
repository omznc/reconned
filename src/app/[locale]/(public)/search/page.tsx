import { Calendar, Shield, Users } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import type { SearchResultsPage, WithContext } from "schema-dts";
import { Pagination } from "@/app/[locale]/(public)/_components/pagination";
import { Search } from "@/app/[locale]/(public)/search/_components/search";
import { SearchResultCard } from "@/app/[locale]/(public)/search/_components/search-result-card";
import { AdminIcon, VerifiedClubIcon } from "@/components/icons";
import JsonLdScript from "@/components/json-ld-script";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

const ITEMS_PER_PAGE = 10;

export const dynamic = "force-dynamic";

async function SearchResults({
	query,
	tab,
	clubsPage,
	usersPage,
	eventsPage,
}: {
	query?: string;
	tab?: string;
	clubsPage: number;
	usersPage: number;
	eventsPage: number;
}) {
	const clubsSkip = (clubsPage - 1) * ITEMS_PER_PAGE;
	const usersSkip = (usersPage - 1) * ITEMS_PER_PAGE;
	const eventsSkip = (eventsPage - 1) * ITEMS_PER_PAGE;

	const clubWhere = {
		...(query
			? {
					OR: [
						{
							name: {
								contains: query,
								mode: "insensitive" as const,
							},
						},
						{
							description: {
								contains: query,
								mode: "insensitive" as const,
							},
						},
					],
				}
			: {}),
		isPrivate: false,
	};

	const userWhere = {
		...(query
			? {
					OR: [
						{
							callsign: {
								contains: query,
								mode: "insensitive" as const,
							},
						},
						{
							name: {
								contains: query,
								mode: "insensitive" as const,
							},
						},
						{
							location: {
								contains: query,
								mode: "insensitive" as const,
							},
						},
					],
				}
			: {}),
		isPrivate: false,
	};

	const eventWhere = {
		...(query
			? {
					OR: [
						{
							name: {
								contains: query,
								mode: "insensitive" as const,
							},
						},
						{
							description: {
								contains: query,
								mode: "insensitive" as const,
							},
						},
						{
							location: {
								contains: query,
								mode: "insensitive" as const,
							},
						},
					],
				}
			: {}),
		isPrivate: false,
	};

	const [clubs, clubsTotal, users, usersTotal, events, eventsTotal] = await Promise.all([
		prisma.club.findMany({
			where: clubWhere,
			include: {
				_count: {
					select: { members: true },
				},
			},
			orderBy: [{ verified: "desc" }, { members: { _count: "desc" } }, { name: "asc" }],
			skip: clubsSkip,
			take: ITEMS_PER_PAGE,
		}),
		prisma.club.count({ where: clubWhere }),
		prisma.user.findMany({
			where: userWhere,
			include: {
				clubMembership: {
					include: {
						club: {
							select: {
								name: true,
							},
						},
					},
					where: {
						club: {
							isPrivate: false,
						},
					},
				},
			},
			orderBy: [{ role: "asc" }, { createdAt: "desc" }],
			skip: usersSkip,
			take: ITEMS_PER_PAGE,
		}),
		prisma.user.count({ where: userWhere }),
		prisma.event.findMany({
			where: eventWhere,
			include: {
				club: true,
			},
			orderBy: { dateStart: "asc" },
			skip: eventsSkip,
			take: ITEMS_PER_PAGE,
		}),
		prisma.event.count({ where: eventWhere }),
	]);

	const t = await getTranslations();
	const locale = await getLocale();

	// Determine the first non-empty tab
	const defaultTab =
		tab ||
		(() => {
			if (clubsTotal > 0) {
				return "clubs";
			}
			if (usersTotal > 0) {
				return "users";
			}
			if (eventsTotal > 0) {
				return "events";
			}
			return "clubs"; // fallback to clubs if all empty
		})();

	return (
		<TooltipProvider>
			<Tabs defaultValue={defaultTab} className="w-full">
				<TabsList className="grid w-full grid-cols-3 mb-8">
					<TabsTrigger value="clubs" className="text-xs flex gap-2">
						<Shield className="h-4 w-4 hidden md:block" />
						{t("public.search.clubs")} ({clubsTotal})
					</TabsTrigger>
					<TabsTrigger value="users" className="text-xs flex gap-2">
						<Users className="h-4 w-4 hidden md:block" />
						{t("public.search.users")} ({usersTotal})
					</TabsTrigger>
					<TabsTrigger value="events" className="text-xs flex gap-2">
						<Calendar className="h-4 w-4 hidden md:block" />
						{t("public.search.events")} ({eventsTotal})
					</TabsTrigger>
				</TabsList>

				<TabsContent value="clubs" className="grid gap-4">
					{clubs.length === 0 ? (
						<div className="text-center text-muted-foreground py-12">{t("public.search.noResults")}</div>
					) : (
						<>
							{clubs.map((club) => (
								<SearchResultCard
									image={club.logo}
									key={club.id}
									title={
										<span className="flex gap-2 items-center">
											{club.name} {club.verified && <VerifiedClubIcon />}
										</span>
									}
									description={club.description}
									href={`/clubs/${club.slug ?? club.id}`}
									meta={`${club._count.members} ${
										club._count.members === 1
											? t("public.search.member")
											: t("public.search.members")
									}`}
									type="club"
								/>
							))}
							<Pagination totalItems={clubsTotal} itemsPerPage={ITEMS_PER_PAGE} paramKey="clubsPage" />
						</>
					)}
				</TabsContent>

				<TabsContent value="users" className="grid gap-4">
					{users.length === 0 ? (
						<div className="text-center text-muted-foreground py-12">{t("public.search.noResults")}</div>
					) : (
						<>
							{users.map((user) => (
								<SearchResultCard
									image={user.image}
									key={user.id}
									title={
										<span className="flex gap-2 items-center">
											{user.name} {user.callsign ? `(${user.callsign})` : ""}{" "}
											{user.role === "admin" && <AdminIcon />}
										</span>
									}
									description={user.bio}
									href={`/users/${user.slug ?? user.id}`}
									badges={
										user.clubMembership.length === 0
											? ["Freelancer"]
											: user.clubMembership.map((membership) => membership.club.name)
									}
									meta={user.location || undefined}
									type="user"
								/>
							))}
							<Pagination totalItems={usersTotal} itemsPerPage={ITEMS_PER_PAGE} paramKey="usersPage" />
						</>
					)}
				</TabsContent>

				<TabsContent value="events" className="grid gap-4">
					{events.length === 0 ? (
						<div className="text-center text-muted-foreground py-12">{t("public.search.noResults")}</div>
					) : (
						<>
							{events.map((event) => (
								<SearchResultCard
									image={event.image}
									key={event.id}
									title={event.name}
									description={event.description}
									href={`/events/${event.slug ?? event.id}`}
									badges={[
										event.club.name,
										event.isPrivate ? t("public.search.private") : t("public.search.public"),
										event.dateStart.toLocaleDateString(locale, {
											year: "numeric",
											month: "long",
											day: "numeric",
										}),
									]}
									meta={event.location || undefined}
									type="event"
								/>
							))}
							<Pagination totalItems={eventsTotal} itemsPerPage={ITEMS_PER_PAGE} paramKey="eventsPage" />
						</>
					)}
				</TabsContent>
			</Tabs>
		</TooltipProvider>
	);
}

export default async function SearchPage(props: PageProps<"/[locale]/search">) {
	const [{ q, tab, clubsPage, usersPage, eventsPage }, locale] = await Promise.all([props.searchParams, getLocale()]);
	const t = await getTranslations();

	const parsePageParam = (value?: string | string[]) => {
		const rawValue = Array.isArray(value) ? value[0] : value;
		const parsed = Number(rawValue);
		if (Number.isInteger(parsed) && parsed > 0) {
			return parsed;
		}
		return 1;
	};

	const clubsPageNumber = parsePageParam(clubsPage);
	const usersPageNumber = parsePageParam(usersPage);
	const eventsPageNumber = parsePageParam(eventsPage);

	const searchSchema: WithContext<SearchResultsPage> = {
		"@context": "https://schema.org",
		"@type": "SearchResultsPage",
		"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${locale}/search${q ? `?q=${encodeURIComponent(q)}` : ""}`,
		name: t("public.search.metadata.title", { query: q }),
		description: t("public.search.metadata.description", { query: q }),
		url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${locale}/search${q ? `?q=${encodeURIComponent(q)}` : ""}`,
		mainEntity: {
			"@type": "WebSite",
			"@id": env.NEXT_PUBLIC_BETTER_AUTH_URL,
			name: "Reconned",
			url: env.NEXT_PUBLIC_BETTER_AUTH_URL,
			potentialAction: {
				"@type": "SearchAction",
				target: {
					"@type": "EntryPoint",
					urlTemplate: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${locale}/search?q={search_term_string}`,
				},
				"query-input": "required name=search_term_string",
				// biome-ignore lint/suspicious/noExplicitAny: Idk how else to get this to work
			} as any,
		},
		about: q
			? {
					"@type": "Thing",
					name: q,
					description: `Search results for: ${q}`,
				}
			: undefined,
	};

	return (
		<div className="container max-w-4xl py-8 space-y-8 px-4">
			<JsonLdScript data={searchSchema} />
			<div>
				<h1 className="text-4xl font-bold mb-2">{t("public.search.title")}</h1>
				<p className="text-muted-foreground">{t("public.search.description")}</p>
			</div>

			<div className="w-full">
				<Search />
			</div>

			<Suspense
				fallback={<div className="text-center text-muted-foreground py-12">{t("public.search.loading")}</div>}
			>
				<SearchResults
					query={q}
					tab={tab}
					clubsPage={clubsPageNumber}
					usersPage={usersPageNumber}
					eventsPage={eventsPageNumber}
				/>
			</Suspense>
		</div>
	);
}

export async function generateMetadata(props: PageProps<"/[locale]/search">): Promise<Metadata> {
	const [{ q }, locale] = await Promise.all([props.searchParams, getLocale()]);
	const t = await getTranslations();

	const path = `/search${q ? `?q=${encodeURIComponent(q)}` : ""}`;

	return {
		title: t("public.search.metadata.title", {
			query: q,
		}),
		description: t("public.search.metadata.description", {
			query: q,
		}),
		keywords: t("public.search.metadata.keywords")
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("public.search.metadata.title", { query: q }),
			description: t("public.search.metadata.description", { query: q }),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", path, locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("public.search.metadata.title", { query: q }),
			description: t("public.search.metadata.description", { query: q }),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", path, locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", path, locale),
		},
	};
}
