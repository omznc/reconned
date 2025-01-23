"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Crown, VerifiedIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function AdminIcon() {
    const t = useTranslations("components.icons");

    return (
        <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
                <Crown className="h-4 w-4 mt-[1px] text-red-500" />
            </TooltipTrigger>
            <TooltipContent>
                <p>{t("administrator")}</p>
            </TooltipContent>
        </Tooltip >
    );
}

export function VerifiedClubIcon() {
    const t = useTranslations("components.icons");

    return (
        <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
                <VerifiedIcon className="h-4 w-4 mt-[1px] text-red-500" />
            </TooltipTrigger>
            <TooltipContent>
                <p>{t("verifiedClub")}</p>
            </TooltipContent>
        </Tooltip >
    );
}

