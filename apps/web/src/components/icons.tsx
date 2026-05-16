"use client";

import { Crown, UserCog, VerifiedIcon, Wrench } from "lucide-react";
import { useExtracted } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AdminIcon() {
	const t = useExtracted();

	return (
		<Tooltip delayDuration={100}>
			<TooltipTrigger asChild>
				<Wrench className="h-4 w-4 mt-[1px] text-red-500" />
			</TooltipTrigger>
			<TooltipContent>
				<p>{t("Administrator")}</p>
			</TooltipContent>
		</Tooltip>
	);
}

export function VerifiedClubIcon() {
	const t = useExtracted();

	return (
		<Tooltip delayDuration={100}>
			<TooltipTrigger asChild>
				<VerifiedIcon className="h-4 w-4 mt-[1px] text-red-500" />
			</TooltipTrigger>
			<TooltipContent>
				<p>{t("Verified club")}</p>
			</TooltipContent>
		</Tooltip>
	);
}

export function ClubOwnerIcon() {
	const t = useExtracted();

	return (
		<Tooltip delayDuration={100}>
			<TooltipTrigger asChild>
				<Crown className="h-4 w-4 mt-[1px] text-black dark:text-white" />
			</TooltipTrigger>
			<TooltipContent>
				<p>{t("Club owner")}</p>
			</TooltipContent>
		</Tooltip>
	);
}

export function ClubManagerIcon() {
	const t = useExtracted();

	return (
		<Tooltip delayDuration={100}>
			<TooltipTrigger asChild>
				<UserCog className="h-4 w-4 mt-[1px] text-black dark:text-white" />
			</TooltipTrigger>
			<TooltipContent>
				<p>{t("Club manager")}</p>
			</TooltipContent>
		</Tooltip>
	);
}

export function FacebookIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			role="img"
			aria-label="Facebook"
		>
			<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3V2z" />
		</svg>
	);
}

export function InstagramIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			role="img"
			aria-label="Instagram"
		>
			<rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
			<path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
			<line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
		</svg>
	);
}
