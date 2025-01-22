import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Crown, VerifiedIcon } from "lucide-react";

export function AdminIcon() {
    return (
        <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
                <Crown className="h-4 w-4 mt-[1px] text-red-500" />
            </TooltipTrigger>
            <TooltipContent>
                <p>Administrator</p>
            </TooltipContent>
        </Tooltip >
    );
}

export function VerifiedClubIcon() {
    return (
        <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
                <VerifiedIcon className="h-4 w-4 mt-[1px] text-red-500" />
            </TooltipTrigger>
            <TooltipContent>
                <p>Verified Club</p>
            </TooltipContent>
        </Tooltip >
    );
}

