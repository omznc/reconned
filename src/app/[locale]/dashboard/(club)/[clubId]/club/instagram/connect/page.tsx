"use client";

import { useEffect } from "react";
import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function InstagramConnectPage({
	params,
}: {
	params: { clubId: string };
}) {
	const router = useRouter();
	const t = useTranslations("dashboard.club.info");

	useEffect(() => {
		async function initiateConnection() {
			try {
				const response = await fetch(
					`/api/club/instagram/authorize?clubId=${params.clubId}`,
				);
				const data = await response.json();

				if (data.url) {
					window.location.href = data.url;
				} else {
					// If no URL is returned, redirect back to the club information page
					router.push(
						`/dashboard/${params.clubId}/club/information?instagramError=failed_to_connect`,
					);
				}
			} catch (error) {
				router.push(
					`/dashboard/${params.clubId}/club/information?instagramError=failed_to_connect`,
				);
			}
		}

		initiateConnection();
	}, [params.clubId, router]);

	return (
		<div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
			<div className="flex flex-col items-center text-center">
				<h1 className="text-3xl font-bold mb-2">{t("instagramConnecting")}</h1>
				<p className="text-muted-foreground mb-8">
					{t("instagramRedirecting")}
				</p>
				<Loader className="h-12 w-12 animate-spin" />
			</div>
		</div>
	);
}
