import { Star } from "lucide-react";
import type { ReactNode } from "react";
import type { Href, IconComponent } from "@/components/redesign/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Side identity layout: the panel stacks on top on a phone, and sits on the left on a wide screen. */
export function ProfileShell({ aside, children }: { aside: ReactNode; children: ReactNode }) {
	return (
		<div className="mx-auto grid w-full max-w-[1200px] gap-6 px-4 py-8 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:items-start">
			<aside className="flex min-w-0 flex-col gap-4">{aside}</aside>
			<div className="flex min-w-0 flex-col gap-5">{children}</div>
		</div>
	);
}

/** A small card of the side panel, for example "Members" or "Contact". */
export function AsideCard({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
	return (
		<section className="rounded-lg border bg-card text-card-foreground">
			<header className="flex items-center justify-between gap-3 border-b px-4 py-3">
				<h2 className="text-sm font-semibold">{title}</h2>
				{meta ? <span className="text-xs text-muted-foreground tabular-nums">{meta}</span> : null}
			</header>
			<div className="p-2">{children}</div>
		</section>
	);
}

export interface ContactItem {
	icon: IconComponent;
	label: string;
	href?: Href;
	external?: boolean;
	/** A private value is shown dimmed and has no link. */
	muted?: boolean;
}

export function ContactList({ items }: { items: ContactItem[] }) {
	return (
		<ul className="flex flex-col">
			{items.map((item) => {
				const Icon = item.icon;
				const body = (
					<>
						<Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden={true} />
						<span className="min-w-0 flex-1 truncate">{item.label}</span>
					</>
				);
				const base = "flex items-center gap-3 rounded-md p-2 text-[13px]";
				return (
					<li key={item.label}>
						{item.href && !item.muted ? (
							<Link
								href={item.href}
								{...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
								className={cn(
									base,
									"outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50",
								)}
							>
								{body}
							</Link>
						) : (
							<div className={cn(base, item.muted && "text-muted-foreground")}>{body}</div>
						)}
					</li>
				);
			})}
		</ul>
	);
}

export function Stars({ value, className }: { value: number; className?: string }) {
	return (
		<span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden={true}>
			{[1, 2, 3, 4, 5].map((star) => (
				<Star
					key={star}
					className={cn(
						"size-3.5",
						star <= Math.round(value)
							? "fill-yellow-400 text-yellow-400"
							: "fill-muted text-muted-foreground",
					)}
				/>
			))}
		</span>
	);
}

/** The rating cell of a stat strip: "4.7" and one star. */
export function RatingValue({ average }: { average: number }) {
	return (
		<>
			{average.toFixed(1)}
			<Star className="size-4 fill-yellow-400 text-yellow-400" aria-hidden={true} />
		</>
	);
}
