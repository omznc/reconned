"use client";

import { Hash } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { toast } from "sonner";
import DeleteClubPhoto1 from "@/../public/help/delete-club-photo-1.png";
import DeleteClubPhoto2 from "@/../public/help/delete-club-photo-2.png";
import GoogleMap1Image from "@/../public/help/google-map-1.png";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function Page() {
	const t = useTranslations();
	return (
		<>
			<div className="mb-6">
				<h3 className="text-lg font-semibold">{t("dashboard.help.title")}</h3>
			</div>
			<Accordion type="single" collapsible className="space-y-4">
				<HelpItem title={t("dashboard.help.googleMaps.title")} id="google-maps">
					<div className="space-y-4 text-muted-foreground">
						<ol className="pl-4 space-y-2 list-disc">
							<li>{t("dashboard.help.googleMaps.steps.step1")}</li>
							<li>{t("dashboard.help.googleMaps.steps.step2")}</li>
							<li>{t("dashboard.help.googleMaps.steps.step3")}</li>
							<li>{t("dashboard.help.googleMaps.steps.step4")}</li>
							<Image
								src={GoogleMap1Image}
								alt="Google Maps dijalog za dijeljenje"
								className="w-full border md:w-1/2 dark:invert"
							/>
							<li>{t("dashboard.help.googleMaps.steps.step5")}</li>
						</ol>
					</div>
				</HelpItem>

				<HelpItem title={t("dashboard.help.deleteClub.title")} id="delete-club">
					<div className="space-y-4 text-muted-foreground">
						<p>{t("dashboard.help.deleteClub.description")}</p>
						<ol className="pl-4 space-y-4 list-decimal">
							<li>{t("dashboard.help.deleteClub.steps.step1")}</li>
							<li>{t("dashboard.help.deleteClub.steps.step2")}</li>
							<li>{t("dashboard.help.deleteClub.steps.step3")}</li>
							<Image
								src={DeleteClubPhoto1}
								alt="Navigation to club information page"
								className="w-full border md:w-2/3"
							/>
							<li>{t("dashboard.help.deleteClub.steps.step4")}</li>
							<Image src={DeleteClubPhoto2} alt="Delete club button" className="w-full border md:w-2/3" />
						</ol>
						<p className="mt-4 text-sm italic">{t("dashboard.help.deleteClub.notes")}</p>
					</div>
				</HelpItem>
			</Accordion>
		</>
	);
}

function HelpItem({ title, children, id }: { title: string; children: ReactNode; id: string }) {
	return (
		<AccordionItem value={id} className="border rounded-lg px-4">
			<AccordionTrigger className="group">
				<div className="flex items-center gap-2">
					{title}

					<div
						className="opacity-0 group-hover:opacity-100 transition-opacity"
						onClick={(e) => {
							e.stopPropagation();
							const currentNoHash = window.location.href.replace(window.location.hash, "");
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
