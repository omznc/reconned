import { EventCalendar } from "@/components/event-calendar";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	startOfMonth,
	endOfMonth,
	subMonths,
	addMonths,
	parse as parseDateFns,
	format,
	formatDistanceToNow,
} from "date-fns";
import { bs } from "date-fns/locale";
import {
	CalendarDays,
	Clock,
	MapPin,
	DollarSign,
	Calendar,
	Wrench,
	LayoutDashboard,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { BadgeSoon } from "@/components/badge-soon";
import { Logo } from "@/components/logos/logo";

interface PageProps {
	searchParams: Promise<{
		month?: string;
	}>;
}

export default async function Home({ searchParams }: PageProps) {
	const user = await isAuthenticated();
	const { month } = await searchParams;

	const currentDate = month
		? parseDateFns(month, "yyyy-MM", new Date())
		: new Date();
	const startDate = startOfMonth(subMonths(currentDate, 1));
	const endDate = endOfMonth(addMonths(currentDate, 1));

	const conditionalPrivateWhere = user
		? {
				OR: [
					{
						isPrivate: false,
					},
					{
						club: {
							members: {
								some: {
									userId: user?.id,
								},
							},
						},
					},
				],
			}
		: {
				isPrivate: false,
			};

	const events = await prisma.event.findMany({
		where: {
			dateStart: {
				gte: startDate,
				lte: endDate,
			},
			...conditionalPrivateWhere,
		},
		include: {
			club: {
				select: {
					name: true,
				},
			},
		},
	});

	const upcomingEvents = await prisma.event.findMany({
		where: {
			dateStart: {
				gte: new Date(),
			},
			...conditionalPrivateWhere,
		},
		orderBy: {
			dateStart: "asc",
		},
		include: {
			club: {
				select: {
					name: true,
				},
			},
		},
		take: 3,
	});

	return (
		<>
			<div className="relative overflow-hidden flex items-center justify-center w-full">
				<div className="absolute inset-0 bg-gradient-to-b from-red-600/20 to-transparent" />
				<div className="container mx-auto px-4 py-24 max-w-[1200px]">
					<div className="relative max-w-2xl">
						<h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
							Tko smo mi?
						</h1>
						<p className="text-xl text-text/80 mb-8">
							Mi smo dva programera iz Bosne i Hercegovine koji su odlučili da
							prebace Airsoft događanja sa Facebook-a i Viber-a, na nešto
							"naše".
						</p>
					</div>
				</div>
			</div>

			<div className="flex flex-col size-full gap-8 max-w-[1200px] px-4 py-16">
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold">O platformi</h2>
					<p className="text-lg inline">
						Krajnji cilj <Logo className="h-4 w-auto mb-0.5" /> platforme je
						unifikacija airsoft zajednice u Bosni i Hercegovini, a možda i šire.
						Naša platforma omogućava klubovima da se predstave, organizuju
						događanja, i pronađu nove članove. Igračima omogućava da pronađu
						klubove, događanja, i igrače, sve na jednom mjestu.
					</p>
				</div>
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold">Održivost</h2>
					<p className="text-lg">
						Cilj nije, i nikada neće biti čista zarada. Svaki dio platforme će
						eventualno biti open-source, a samim tim i dostupan svima. Trenutno
						kompletno lično finansiramo razvoj platforme, ali ćemo dati
						klubovima i individuama šansu da pomognu u razvoju i održavanju, uz
						neke pogodnosti.{" "}
						<span className="font-bold text-red-600">
							RECONNED će uvijek biti besplatan za korištenje.
						</span>
					</p>
				</div>
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold">Kako pomoći?</h2>
					<p className="text-lg">
						Ako ste zainteresovani za pomoć u razvoju platforme, slobodno nas
						kontaktirajte. Pomoć u obliku marketinga, programiranja, te općenito
						sponsorstva je uvijek dobrodošla.{" "}
						<Link
							className="text-red-600 underline hover:text-red-400 transition-colors"
							// href="/sponsors"
							href="#"
						>
							Pogledajte listu sponzora.
						</Link>{" "}
						<BadgeSoon />
					</p>
				</div>
			</div>
		</>
	);
}
