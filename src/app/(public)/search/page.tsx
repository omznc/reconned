import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { prisma } from "@/lib/prisma";
import {
	Users,
	Shield,
	Calendar,
} from "lucide-react";
import { Suspense } from "react";
import { format } from "date-fns";
import { SearchResultCard } from "@/app/(public)/search/_components/search-result-card";
import { Search } from "@/app/(public)/search/_components/search";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminIcon, VerifiedClubIcon } from "@/components/icons";

interface Props {
	searchParams: Promise<{
		q?: string;
		tab?: string;
	}>;
}

async function SearchResults({ query, tab }: { query?: string; tab?: string; }) {
	if (!query) {
		return null;
	}

	const [clubs, users, events] = await Promise.all([
		prisma.club.findMany({
			where: {
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
				AND: { isPrivate: false },
			},
			include: {
				club: true,
			},
			take: 25,
		}),
	]);

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
					<TabsTrigger value="clubs" className="flex gap-2">
						<Shield className="h-4 w-4 hidden md:block" />
						Klubovi ({clubs.length})
					</TabsTrigger>
					<TabsTrigger value="users" className="flex gap-2">
						<Users className="h-4 w-4 hidden md:block" />
						Korisnici ({users.length})
					</TabsTrigger>
					<TabsTrigger value="events" className="flex gap-2">
						<Calendar className="h-4 w-4 hidden md:block" />
						Susreti ({events.length})
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
								image={club.logo}
								key={club.id}
								title={
									<span className="flex gap-2 items-center">
										{club.name}{" "}
										{club.verified && <VerifiedClubIcon />}
									</span>
								}
								description={club.description}
								href={`/clubs/${club.id}`}
								meta={`${club._count.members} članova`}
								type="club"
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
								image={user.image}
								key={user.id}
								title={
									<span className="flex gap-2 items-center">
										{user.name} {user.callsign ? `(${user.callsign})` : ""}{" "}
										{(user.role === "admin" || user.isAdmin) && (
											<AdminIcon />
										)}
									</span>
								}
								description={user.bio}
								href={`/users/${user.id}`}
								badges={
									user.clubMembership.length === 0
										? ["Freelancer"]
										: user.clubMembership.map(
											(membership) => membership.club.name,
										)
								}
								meta={user.location || undefined}
								type="user"
							/>
						))
					)}
				</TabsContent>

				<TabsContent value="events" className="grid gap-4">
					{events.length === 0 ? (
						<div className="text-center text-muted-foreground py-12">
							Nema pronađenih susreta
						</div>
					) : (
						events.map((event) => (
							<SearchResultCard
								image={event.image}
								key={event.id}
								title={event.name}
								description={event.description}
								href={`/events/${event.id}`}
								badges={[
									event.club.name,
									event.isPrivate ? "Privatno" : "Javno",
									format(event.dateStart, "dd.MM.yyyy"),
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

	return (
		<div className="container max-w-4xl py-8 space-y-8 px-4">
			<div>
				<h1 className="text-4xl font-bold mb-2">Pretraga</h1>
				<p className="text-muted-foreground">
					Pronađi klubove, korisnike i susrete na jednom mjestu
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
