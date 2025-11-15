"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExpandableDescriptionProps {
	description: string;
	translationNamespace?: string;
}

export function ExpandableDescription({ description, translationNamespace = "common.ui" }: ExpandableDescriptionProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const shouldShowButton = description.length > 300; // Show expand button if text is long
	const t = useTranslations(translationNamespace);

	return (
		<div className="space-y-2">
			<p
				className={cn(
					"text-accent-foreground/80 whitespace-pre-wrap",
					!isExpanded && shouldShowButton && "line-clamp-6",
				)}
			>
				{description}
			</p>
			{shouldShowButton && (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setIsExpanded(!isExpanded)}
					className="h-auto p-0 shadow-none text-accent-foreground/60 hover:text-accent-foreground"
				>
					{isExpanded ? (
						<>
							{t("showLess")}
							<ChevronUp className="h-4 w-4 ml-1" />
						</>
					) : (
						<>
							{t("readMore")}
							<ChevronDown className="h-4 w-4 ml-1" />
						</>
					)}
				</Button>
			)}
		</div>
	);
}
