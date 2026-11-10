import type { ReactNode } from "react";
import type { IconComponent } from "@/components/redesign/types";
import { cn } from "@/lib/utils";

interface MiniStatChipProps {
	icon: IconComponent;
	value: ReactNode;
	/** Visible text after the number, for example "players". */
	label?: string;
	className?: string;
}

export function MiniStatChip({ icon: Icon, value, label, className }: MiniStatChipProps) {
	return (
		<span
			className={cn(
				"inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full bg-secondary px-2.5 text-xs font-medium text-secondary-foreground",
				className,
			)}
		>
			<Icon className="size-3.5 shrink-0 text-brand" aria-hidden={true} />
			<span className="font-semibold tabular-nums">{value}</span>
			{label ? <span className="text-muted-foreground">{label}</span> : null}
		</span>
	);
}
