import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatStripItem {
	label: string;
	/** A missing value (`null` or `undefined`) drops the cell. */
	value?: ReactNode | null;
}

interface StatStripProps {
	items: StatStripItem[];
	className?: string;
}

/** Up to 4 cells in a row. In a narrow container the cells wrap to a 2 column grid. */
export function StatStrip({ items, className }: StatStripProps) {
	const cells = items.filter((item) => item.value !== null && item.value !== undefined).slice(0, 4);
	if (cells.length === 0) {
		return null;
	}
	const style = { "--cols": `repeat(${cells.length}, minmax(0, 1fr))` } as CSSProperties;
	return (
		<div className={cn("@container", className)}>
			<dl
				style={style}
				className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border @xl:grid-cols-(--cols) [&>div:last-child:nth-child(odd)]:col-span-full @xl:[&>div:last-child:nth-child(odd)]:col-auto"
			>
				{cells.map((item) => (
					<div key={item.label} className="flex min-w-0 flex-col gap-1 bg-card px-[18px] py-4">
						<dt className="text-xs font-medium leading-4 text-muted-foreground">{item.label}</dt>
						<dd className="flex items-center gap-1.5 text-[22px] font-bold leading-7 tabular-nums">
							{item.value}
						</dd>
					</div>
				))}
			</dl>
		</div>
	);
}
