import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { prisma } from "@/lib/prisma";
import { Users, Shield, Calendar } from "lucide-react";
import { Suspense } from "react";
import { format } from "date-fns";
import { SearchResultCard } from "@/app/(public)/search/_components/search-result-card";
import { Search } from "@/app/(public)/search/_components/search";

interface Props {
	searchParams: Promise<{
		q?: string;
		tab?: string;
	}>;
}

async function SearchResults({ query, tab }: { query?: string; tab?: string; }) {
	if (!query) {
		return (
			<div className="text-center text-muted-foreground py-12">
				Unesite tekst za pretragu iznad
			</div>
		);
	}

	const [clubs, users, events] = await Promise.all([
		prisma.club.findMany({
			where: {
				OR: [
					{
						name: {
							contains: query,
							mode: "insensitive"
						}
					},
					{
						description: {
							contains: query,
							mode: "insensitive"
						}
					},
				],
				AND: { isPrivate: false },
			},
			include: {
				_count: {
					select: { members: true }
				}
			},
			take: 25

		}),
		prisma.user.findMany({
			where: {
				OR: [
					{
						callsign: {
							contains: query,
							mode: "insensitive"
						}
					},
					{
						name: {
							contains: query,
							mode: "insensitive"
						}
					},
					{
						location: {
							contains: query,
							mode: "insensitive"
						}
					},
				],
				AND: { isPrivate: false },
			},
			take: 25

		}),
		prisma.event.findMany({
			where: {
				OR: [
					{
						name: {
							contains: query,
							mode: "insensitive"
						}
					},
					{
						description: {
							contains: query,
							mode: "insensitive"
						}
					},
					{
						location: {
							contains: query,
							mode: "insensitive"
						}
					},
				],
				AND: { isPrivate: false },
			},
			include: {
				club: true
			},
			take: 25
		}),
	]);

	// Determine the first non-empty tab
	const defaultTab = tab || (() => {
		if (clubs.length > 0) return "clubs";
		if (users.length > 0) return "users";
		if (events.length > 0) return "events";
		return "clubs"; // fallback to clubs if all empty
	})();

	return (
		<Tabs defaultValue={defaultTab} className="w-full">
			<TabsList className="grid w-full grid-cols-3 mb-8">
				<TabsTrigger value="clubs" className="flex gap-2">
					<Shield className="h-4 w-4" />
					Klubovi ({clubs.length})
				</TabsTrigger>
				<TabsTrigger value="users" className="flex gap-2">
					<Users className="h-4 w-4" />
					Korisnici ({users.length})
				</TabsTrigger>
				<TabsTrigger value="events" className="flex gap-2">
					<Calendar className="h-4 w-4" />
					Događaji ({events.length})
				</TabsTrigger>
			</TabsList>

			<TabsContent value="clubs" className="grid gap-4">
				{clubs.length === 0 ? (
					<div className="text-center text-muted-foreground py-12">
						Nema pronađenih klubova
					</div>
				) : (
					clubs.map((club) => (
						<SearchResultCard
							key={club.id}
							title={club.name}
							description={club.description}
							href={`/clubs/${club.id}`}
							meta={`${club._count.members} članova`}
						/>
					))
				)}
			</TabsContent>

			<TabsContent value="users" className="grid gap-4">
				{users.length === 0 ? (
					<div className="text-center text-muted-foreground py-12">
						Nema pronađenih korisnika
					</div>
				) : (
					users.map((user) => (
						<SearchResultCard
							key={user.id}
							title={user.callsign || user.name}
							description={user.bio}
							href={`/users/${user.id}`}
							badges={[]}
							meta={user.location || undefined}
						/>
					))
				)}
			</TabsContent>

			<TabsContent value="events" className="grid gap-4">
				{events.length === 0 ? (
					<div className="text-center text-muted-foreground py-12">
						Nema pronađenih događaja
					</div>
				) : (
					events.map((event) => (
						<SearchResultCard
							key={event.id}
							title={event.name}
							description={event.description}
							href={`/events/${event.id}`}
							badges={[
								event.club.name,
								event.isPrivate ? "Privatno" : "Javno",
								format(event.dateStart, "dd.MM.yyyy")
							]}
							meta={event.location || undefined}
						/>
					))
				)}
			</TabsContent>
		</Tabs>
	);
}

export default async function SearchPage(props: Props) {
	const { q, tab } = await props.searchParams;

	return (
		<div className="container max-w-4xl py-8 space-y-8">
			<div>
				<h1 className="text-4xl font-bold mb-2">Pretraga</h1>
				<p className="text-muted-foreground">
					Pronađi klubove, korisnike i događaje na jednom mjestu
				</p>
			</div>

			<div className="w-full">
				<Search />
			</div>

			<Suspense
				fallback={
					<div className="text-center text-muted-foreground py-12">
						Učitavanje rezultata...
					</div>
				}
			>
				<SearchResults query={q} tab={tab} />
			</Suspense>
		</div>
	);
}
