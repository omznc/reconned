"use client";

import { useHash } from "@/hooks/use-hash";
import { Hash } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import GoogleMap1Image from "@/../public/help/google-map-1.png";
import DeleteClubPhoto1 from "@/../public/help/delete-club-photo-1.png";
import DeleteClubPhoto2 from "@/../public/help/delete-club-photo-2.png";
import Image from "next/image";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslations } from "next-intl";

export default function Page() {
	const t = useTranslations("dashboard.help");
	return (
		<>
			<div className="mb-6">
				<h3 className="text-lg font-semibold">{t("title")}</h3>
			</div>
			<Accordion type="single" collapsible className="space-y-4">
				<HelpItem title={t("googleMaps.title")} id="google-maps">
					<div className="space-y-4 text-muted-foreground">
						<ol className="pl-4 space-y-2 list-disc">
							<li>{t("googleMaps.steps.step1")}</li>
							<li>{t("googleMaps.steps.step2")}</li>
							<li>{t("googleMaps.steps.step3")}</li>
							<li>{t("googleMaps.steps.step4")}</li>
							<Image
								src={GoogleMap1Image}
								alt="Google Maps dijalog za dijeljenje"
								className="w-full border md:w-1/2 dark:invert"
							/>
							<li>{t("googleMaps.steps.step5")}</li>
						</ol>
					</div>
				</HelpItem>

				<HelpItem title={t("deleteClub.title")} id="delete-club">
					<div className="space-y-4 text-muted-foreground">
						<p>{t("deleteClub.description")}</p>
						<ol className="pl-4 space-y-4 list-decimal">
							<li>{t("deleteClub.steps.step1")}</li>
							<li>{t("deleteClub.steps.step2")}</li>
							<li>{t("deleteClub.steps.step3")}</li>
							<Image
								src={DeleteClubPhoto1}
								alt="Navigation to club information page"
								className="w-full border md:w-2/3"
							/>
							<li>{t("deleteClub.steps.step4")}</li>
							<Image
								src={DeleteClubPhoto2}
								alt="Delete club button"
								className="w-full border md:w-2/3"
							/>
						</ol>
						<p className="mt-4 text-sm italic">{t("deleteClub.notes")}</p>
					</div>
				</HelpItem>
			</Accordion>
		</>
	);
}

function HelpItem({
	title,
	children,
	id,
}: {
	title: string;
	children: ReactNode;
	id: string;
}) {
	const hash = useHash();

	return (
		<AccordionItem value={id} className="border rounded-lg px-4">
			<AccordionTrigger className="group">
				<div className="flex items-center gap-2">
					{title}

					<div
						className="opacity-0 group-hover:opacity-100 transition-opacity"
						onClick={(e) => {
							e.stopPropagation();
							const currentNoHash = window.location.href.replace(
								window.location.hash,
								"",
							);
							window.navigator.clipboard
								.writeText(`${currentNoHash}#${id}`)
								.then(() => {
									toast.success("Link kopiran.");
								})
								.catch(() => {
									toast.error("Neuspješno kopiranje linka.");
								});
						}}
					>
						<Hash className="w-4 h-4" />
					</div>
				</div>
			</AccordionTrigger>
			<AccordionContent>{children}</AccordionContent>
		</AccordionItem>
	);
}
