"use client";

import { Globe } from "lucide-react";
import { useExtracted } from "next-intl";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ClubWebsiteButtonProps {
	website: string;
	isVerified?: boolean;
}

export function ClubWebsiteButton({ website, isVerified = false }: ClubWebsiteButtonProps) {
	const t = useExtracted();

	const formatWebsiteDisplay = (url: string) => {
		try {
			const parsedUrl = new URL(url);
			let host = parsedUrl.hostname;
			if (host.startsWith("www.")) {
				host = host.slice(4);
			}
			const path = parsedUrl.pathname === "/" ? "" : parsedUrl.pathname;
			const display = `${host}${path}`;
			return display.length > 25 ? `${display.slice(0, 25)}...` : display;
		} catch {
			return url.length > 25 ? `${url.slice(0, 25)}...` : url;
		}
	};

	const handleContinue = () => {
		window.open(website, "_blank", "noopener,noreferrer");
	};

	const handleDirectClick = () => {
		window.open(website, "_blank", "noopener,noreferrer");
	};

	if (isVerified) {
		return (
			<Button variant="default" onClick={handleDirectClick}>
				<Globe className="h-4 w-4 mr-2" />
				{formatWebsiteDisplay(website)}
			</Button>
		);
	}

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="default">
					<Globe className="h-4 w-4 mr-2" />
					{formatWebsiteDisplay(website)}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("You're leaving RECONNED")}</AlertDialogTitle>
					<AlertDialogDescription>
						{t("You're about to visit an external website. Are you sure you want to continue?")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
					<AlertDialogAction onClick={handleContinue}>{t("Continue")}</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
