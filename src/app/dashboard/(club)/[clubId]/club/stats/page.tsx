import { format, subMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { StatsCharts } from "@/app/dashboard/(club)/[clubId]/club/stats/_components/stats-charts";
import { bs } from "date-fns/locale";

async function getClubStats(clubId: string) {
	const now = new Date();

	// First get club creation date
	const club = await prisma.club.findUnique({
		where: { id: clubId },
		select: { createdAt: true },
	});

	if (!club) {
		throw new Error("Club not found");
	}

	// Members since club creation
	const members = await prisma.$queryRaw<Array<{ date: Date; count: number }>>`
		WITH RECURSIVE dates AS (
			SELECT DATE(date_trunc('day', ${club.createdAt}))::timestamp as date
			UNION ALL
			SELECT (date + INTERVAL '1 day')::timestamp
			FROM dates
			WHERE date < DATE(NOW())
		)
		SELECT 
			d.date::date as date,
			COUNT(DISTINCT cm.id) as count
		FROM dates d
		LEFT JOIN "ClubMembership" cm ON 
			DATE(cm."createdAt") <= d.date::date 
			AND cm."clubId" = ${clubId}
		GROUP BY d.date
		ORDER BY d.date ASC
	`;

	// Role distribution
	const roleDistribution = await prisma.clubMembership.groupBy({
		by: ["role"],
		where: { clubId },
		_count: true,
	});

	// Modified events per month query to use a CTE for all months
	const eventsPerMonth = await prisma.$queryRaw<
		Array<{ month: Date; count: number }>
	>`
		WITH RECURSIVE months AS (
			SELECT DATE_TRUNC('month', NOW() - INTERVAL '11 months')::date as month
			UNION ALL
			SELECT (month + INTERVAL '1 month')::date
			FROM months
			WHERE month < DATE_TRUNC('month', NOW())
		)
		SELECT 
			m.month,
			COUNT(e.id) as count
		FROM months m
		LEFT JOIN "Event" e ON 
			DATE_TRUNC('month', e."dateStart") = m.month 
			AND e."clubId" = ${clubId}
		GROUP BY m.month
		ORDER BY m.month ASC
	`;

	// Recent event registrations
	const recentEvents = await prisma.event.findMany({
		where: { clubId },
		orderBy: { dateStart: "desc" },
		take: 10,
		include: {
			_count: {
				select: { eventRegistration: true },
			},
		},
	});

	return {
		members,
		roles: roleDistribution,
		events: eventsPerMonth,
		recentEvents,
	};
}

export default async function Page(props: {
	params: Promise<{ clubId: string }>;
}) {
	const params = await props.params;
	const stats = await getClubStats(params.clubId);

	// Format data for charts
	const memberData = stats.members.map((item) => ({
		date: format(item.date, "dd.MM"),
		members: Number(item.count),
	}));

	const roleData = stats.roles.map((item) => ({
		role: item.role.toLowerCase(),
		count: item._count,
	}));

	// Modified event data formatting to use bs-locale
	const eventData = stats.events.map((item) => ({
		month: format(item.month, "MMMM", { locale: bs }),
		count: Number(item.count),
	}));

	const registrationData = stats.recentEvents.map((event) => ({
		name: event.name,
		registrations: event._count.eventRegistration,
	}));

	return (
		<StatsCharts
			memberData={memberData}
			roleData={roleData}
			eventData={eventData}
			registrationData={registrationData}
		/>
	);
}
