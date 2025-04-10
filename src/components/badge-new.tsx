import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface BadgeNewProps extends React.HTMLAttributes<HTMLDivElement> {
	className?: string;
}

export function BadgeNew({ className, ...props }: BadgeNewProps) {
	const t = useTranslations("components.badge");
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-500 transition-colors hover:bg-green-500/20",
				className,
			)}
			{...props}
		>
			{t("new")}
		</span>
	);
}
