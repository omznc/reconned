"use client";

import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
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
	const t = useTranslations();

	const formatWebsiteDisplay = (url: string) => {
		try {
			const parsedUrl = new URL(url);
			let host = parsedUrl.hostname;
			if (host.startsWith("www.")) {
				host = host.slice(4);
			}
			if (host.endsWith(".com")) {
				host = host.slice(0, -4);
			}
			host = host.charAt(0).toUpperCase() + host.slice(1);
			return host.length > 25 ? `${host.slice(0, 25)}...` : host;
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
					<AlertDialogTitle>{t("components.clubOverview.leavingReconned")}</AlertDialogTitle>
					<AlertDialogDescription>
						{t("components.clubOverview.leavingReconnedDescription")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{t("components.clubOverview.cancel")}</AlertDialogCancel>
					<AlertDialogAction onClick={handleContinue}>
						{t("components.clubOverview.continue")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
