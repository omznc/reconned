import { cn } from "@/lib/utils";

interface BadgeSoonProps extends React.HTMLAttributes<HTMLDivElement> {
	className?: string;
}

export function BadgeSoon({ className, ...props }: BadgeSoonProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/20",
				className,
			)}
			{...props}
		>
			Uskoro
		</span>
	);
}
