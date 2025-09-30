import { Calendar, Shield, Users } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import type { SearchResultsPage, WithContext } from "schema-dts";
import { Search } from "@/app/[locale]/(public)/search/_components/search";
import { SearchResultCard } from "@/app/[locale]/(public)/search/_components/search-result-card";
import { AdminIcon, VerifiedClubIcon } from "@/components/icons";
import JsonLdScript from "@/components/json-ld-script";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

interface Props {
	searchParams: Promise<{
		q?: string;
		tab?: string;
	}>;
}

async function SearchResults({ query, tab }: { query?: string; tab?: string }) {
	const [clubs, users, events] = await Promise.all([
		prisma.club.findMany({
			where: {
				...(query
					? {
							OR: [
								{
									name: {
										contains: query,
										mode: "insensitive",
									},
								},
								{
									description: {
										contains: query,
										mode: "insensitive",
									},
								},
							],
						}
					: {}),
				AND: { isPrivate: false },
			},
			include: {
				_count: {
					select: { members: true },
				},
			},
			take: 25,
		}),
		prisma.user.findMany({
			where: {
				...(query
					? {
							OR: [
								{
									callsign: {
										contains: query,
										mode: "insensitive",
									},
								},
								{
									name: {
										contains: query,
										mode: "insensitive",
									},
								},
								{
									location: {
										contains: query,
										mode: "insensitive",
									},
								},
							],
						}
					: {}),
				AND: { isPrivate: false },
			},
			take: 25,
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
		}),
		prisma.event.findMany({
			where: {
				...(query
					? {
							OR: [
								{
									name: {
										contains: query,
										mode: "insensitive",
									},
								},
								{
									description: {
										contains: query,
										mode: "insensitive",
									},
								},
								{
									location: {
										contains: query,
										mode: "insensitive",
									},
								},
							],
						}
					: {}),
				AND: { isPrivate: false },
			},
			include: {
				club: true,
			},
			take: 25,
		}),
	]);
	const t = await getTranslations();
	const locale = await getLocale();

	// Determine the first non-empty tab
	const defaultTab =
		tab ||
		(() => {
			if (clubs.length > 0) {
				return "clubs";
			}
			if (users.length > 0) {
				return "users";
			}
			if (events.length > 0) {
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
						{t("public.search.clubs")} ({clubs.length})
					</TabsTrigger>
					<TabsTrigger value="users" className="text-xs flex gap-2">
						<Users className="h-4 w-4 hidden md:block" />
						{t("public.search.users")} ({users.length})
					</TabsTrigger>
					<TabsTrigger value="events" className="text-xs flex gap-2">
						<Calendar className="h-4 w-4 hidden md:block" />
						{t("public.search.events")} ({events.length})
					</TabsTrigger>
				</TabsList>

				<TabsContent value="clubs" className="grid gap-4">
					{clubs.length === 0 ? (
						<div className="text-center text-muted-foreground py-12">{t("public.search.noResults")}</div>
					) : (
						clubs
							.sort((a, b) => b._count.members - a._count.members)
							.map((club) => (
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
							))
					)}
				</TabsContent>

				<TabsContent value="users" className="grid gap-4">
					{users.length === 0 ? (
						<div className="text-center text-muted-foreground py-12">{t("public.search.noResults")}</div>
					) : (
						users
							.sort((a, b) => {
								if (a.role === "admin") {
									return -1;
								}
								if (b.role === "admin") {
									return 1;
								}
								return 0;
							})
							.map((user) => (
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
							))
					)}
				</TabsContent>

				<TabsContent value="events" className="grid gap-4">
					{events.length === 0 ? (
						<div className="text-center text-muted-foreground py-12">{t("public.search.noResults")}</div>
					) : (
						events
							.sort((a, b) => a.dateStart.getTime() - b.dateStart.getTime())
							.map((event) => (
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
							))
					)}
				</TabsContent>
			</Tabs>
		</TooltipProvider>
	);
}

export default async function SearchPage(props: Props) {
	const { q, tab } = await props.searchParams;
	const t = await getTranslations();

	const searchSchema: WithContext<SearchResultsPage> = {
		"@context": "https://schema.org",
		"@type": "SearchResultsPage",
		"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/search${q ? `?q=${encodeURIComponent(q)}` : ""}`,
		name: t("public.search.metadata.title", { query: q }),
		description: t("public.search.metadata.description", { query: q }),
		url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/search${q ? `?q=${encodeURIComponent(q)}` : ""}`,
		mainEntity: {
			"@type": "WebSite",
			"@id": env.NEXT_PUBLIC_BETTER_AUTH_URL,
			name: "Reconned",
			url: env.NEXT_PUBLIC_BETTER_AUTH_URL,
			potentialAction: {
				"@type": "SearchAction",
				target: {
					"@type": "EntryPoint",
					urlTemplate: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/search?q={search_term_string}`,
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
				<SearchResults query={q} tab={tab} />
			</Suspense>
		</div>
	);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { q } = await props.searchParams;
	const t = await getTranslations();

	return {
		title: t("public.search.metadata.title", {
			query: q,
		}),
		description: t("public.search.metadata.description", {
			query: q,
		}),
	};
}
