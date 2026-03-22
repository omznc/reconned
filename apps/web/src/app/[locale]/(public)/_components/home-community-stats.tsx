import { Building2, Calendar, Users } from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type HomeCommunityStatsProps = {
	stats: {
		clubs: number;
		events: number;
		players: number;
	};
};

export async function HomeCommunityStats({ stats }: HomeCommunityStatsProps) {
	const t = await getExtracted();
	const locale = await getLocale();
	const nf = new Intl.NumberFormat(locale);

	const segments = [
		{ href: "/users" as const, icon: Users, value: stats.players, label: t("Players") },
		{ href: "/clubs" as const, icon: Building2, value: stats.clubs, label: t("Clubs") },
		{ href: "/events" as const, icon: Calendar, value: stats.events, label: t("Events") },
	];

	return (
		<ul className="m-0 inline-flex max-w-full list-none overflow-hidden rounded-full border border-border/60 bg-background/70 p-0 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm">
			{segments.map((item, index) => {
				const Icon = item.icon;
				return (
					<li key={item.href} className="flex min-w-0">
						<Link
							href={item.href}
							className={
								"flex min-w-0 flex-1 items-center gap-1.5 px-2.5 py-1.5 transition-colors hover:bg-muted/90 " +
								(index < segments.length - 1 ? "border-r border-border/50 " : "")
							}
						>
							<Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
							<span className="tabular-nums tracking-tight">{nf.format(item.value)}</span>
							<span className="sr-only">{item.label}</span>
						</Link>
					</li>
				);
			})}
		</ul>
	);
}
