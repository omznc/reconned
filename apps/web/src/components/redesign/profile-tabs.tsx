import { useExtracted } from "next-intl";
import type { Href } from "@/components/redesign/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface ProfileTab {
	key: string;
	label: string;
	href: Href;
	/** A missing count hides the badge. */
	count?: number | null;
}

interface ProfileTabsProps {
	tabs: ProfileTab[];
	activeKey: string;
	/** Accessible name of the navigation. */
	label?: string;
	className?: string;
}

/** Routable tabs: each one is a link, and the active one carries `aria-current="page"`. */
export function ProfileTabs({ tabs, activeKey, label, className }: ProfileTabsProps) {
	const t = useExtracted();
	return (
		<nav aria-label={label ?? t("Sections")} className={cn("border-b", className)}>
			<ul className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]">
				{tabs.map((tab) => {
					const active = tab.key === activeKey;
					return (
						<li key={tab.key} className="shrink-0">
							<Link
								href={tab.href}
								aria-current={active ? "page" : undefined}
								className={cn(
									"inline-flex h-11 items-center gap-2 border-b-2 px-3 text-[13px] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
									active
										? "border-brand text-foreground"
										: "border-transparent text-muted-foreground hover:text-foreground",
								)}
							>
								{tab.label}
								{tab.count === null || tab.count === undefined ? null : (
									<span className="rounded-full bg-secondary px-[7px] py-px text-[11px] leading-4 text-muted-foreground tabular-nums">
										{tab.count}
									</span>
								)}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
