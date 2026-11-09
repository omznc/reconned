import { BadgeCheck } from "lucide-react";
import { useExtracted } from "next-intl";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
	/** Accessible name. Defaults to "Verified". Use it to say "Verified club". */
	label?: string;
	className?: string;
}

export function VerifiedBadge({ label, className }: VerifiedBadgeProps) {
	const t = useExtracted();
	return (
		<BadgeCheck
			role="img"
			aria-label={label ?? t("Verified")}
			className={cn("inline size-[1em] shrink-0 align-[-0.12em]", className)}
		/>
	);
}
