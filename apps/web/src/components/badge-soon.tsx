import { useExtracted } from "next-intl";
import { cn } from "@/lib/utils";

interface BadgeSoonProps extends React.HTMLAttributes<HTMLDivElement> {
	className?: string;
}

export function BadgeSoon({ className, ...props }: BadgeSoonProps) {
	const t = useExtracted();
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/20",
				className,
			)}
			{...props}
		>
			{t("Soon")}
		</span>
	);
}
