"use client";

import { Hash } from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";
import { toast } from "sonner";
import DeleteClubPhoto1 from "@/../public/help/delete-club-photo-1.png";
import DeleteClubPhoto2 from "@/../public/help/delete-club-photo-2.png";
import GoogleMap1Image from "@/../public/help/google-map-1.png";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { IMAGE_SIZES } from "@/lib/image-sizes";

export default function Page() {
	const t = useExtracted();
	return (
		<>
			<div className="mb-6">
				<h3 className="text-lg font-semibold">{t("Help")}</h3>
			</div>
			<Accordion type="single" collapsible className="space-y-4">
				<HelpItem title={t("How to add a Google Maps link to an event")} id="google-maps">
					<div className="space-y-4 text-muted-foreground">
						<ol className="pl-4 space-y-2 list-disc">
							<li>{t("Open Google Maps and find the desired location")}</li>
							<li>{t('Click the "Share" button')}</li>
							<li>{t('In the share dialog, select the "Embed a map" tab')}</li>
							<li>{t("Copy the entire link")}</li>
							<Image
								width={IMAGE_SIZES.MEDIUM}
								height={IMAGE_SIZES.MEDIUM}
								src={GoogleMap1Image}
								alt={t("Google Maps share dialog")}
								className="w-full border md:w-1/2 dark:invert"
							/>
							<li>{t("Paste the copied link into the Google Maps field on the event creation form")}</li>
						</ol>
					</div>
				</HelpItem>

				<HelpItem title={t("How to delete a club")} id="delete-club">
					<div className="space-y-4 text-muted-foreground">
						<p>{t("To delete a club, follow these steps:")}</p>
						<ol className="pl-4 space-y-4 list-decimal">
							<li>{t("Select the club you want to delete from the sidebar")}</li>
							<li>{t('Click on "Club" in the menu')}</li>
							<li>{t('Click on "Information" in the submenu')}</li>
							<Image
								width={IMAGE_SIZES.MEDIUM}
								height={IMAGE_SIZES.MEDIUM}
								src={DeleteClubPhoto1}
								alt="Navigation to club information page"
								className="w-full border md:w-2/3"
							/>
							<li>
								{t(
									'On the club information page, find and click the "Delete the club" button in the top right corner',
								)}
							</li>
							<Image
								width={IMAGE_SIZES.MEDIUM}
								height={IMAGE_SIZES.MEDIUM}
								src={DeleteClubPhoto2}
								alt="Delete club button"
								className="w-full border md:w-2/3"
							/>
						</ol>
						<p className="mt-4 text-sm italic">
							{t(
								"Note: Deleting a club is a permanent action and cannot be undone. All events and memberships related to the club will also be deleted.",
							)}
						</p>
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
					{/* biome-ignore lint/a11y/useSemanticElements: Style stuff */}
					<div
						role="button"
						tabIndex={0}
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
