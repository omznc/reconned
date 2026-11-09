import type { ReactNode } from "react";
import type { Href } from "@/components/redesign/types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface SectionCardProps {
	title: ReactNode;
	subtitle?: ReactNode;
	/** The "All events" link. Pass the full visible label. */
	action?: { href: Href; label: string };
	/** Heading level. Use 2 under the page h1, 3 inside another section. */
	headingLevel?: 2 | 3;
	children?: ReactNode;
	className?: string;
	bodyClassName?: string;
}

export function SectionCard({
	title,
	subtitle,
	action,
	headingLevel = 2,
	children,
	className,
	bodyClassName,
}: SectionCardProps) {
	const Heading = headingLevel === 2 ? "h2" : "h3";
	return (
		<section className={cn("@container rounded-lg border bg-card text-card-foreground", className)}>
			<header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b px-6 py-5 @max-md:px-4 @max-md:py-4">
				<div className="min-w-0">
					<Heading className="text-lg font-semibold tracking-tight">{title}</Heading>
					{subtitle ? <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{subtitle}</p> : null}
				</div>
				{action ? (
					<Button asChild={true} variant="secondary" size="sm">
						<Link href={action.href}>{action.label}</Link>
					</Button>
				) : null}
			</header>
			{children ? (
				<div className={cn("px-6 py-5 @max-md:px-4 @max-md:py-4", bodyClassName)}>{children}</div>
			) : null}
		</section>
	);
}
