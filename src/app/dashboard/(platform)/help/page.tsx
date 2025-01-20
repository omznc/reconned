"use client";

import { useHash } from "@/hooks/use-hash";
import { Hash } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import GoogleMap1Image from "@/../public/help/google-map-1.png";
import Image from "next/image";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

export default function Page() {
	return (
		<>
			<div className="mb-6">
				<h3 className="text-lg font-semibold">Pomoć</h3>
			</div>
			<Accordion type="single" collapsible className="space-y-4">
				<HelpItem title="Kako dodati Google Maps na susret" id="google-maps">
					<div className="space-y-4 text-muted-foreground">
						<ol className="list-decimal pl-4 space-y-2">
							<li>Otvorite Google Maps i pronađite željenu lokaciju</li>
							<li>Kliknite na dugme &quot;Share&quot; (Podijeli)</li>
							<li>
								U dijalogu za dijeljenje, odaberite tab &quot;Embed a map&quot;
								(Ugradi mapu)
							</li>
							<li>Kopirajte citav link</li>
							<Image
								src={GoogleMap1Image}
								alt="Google Maps dijalog za dijeljenje"
								className="w-full border md:w-1/2 dark:invert"
							/>
							<li>
								Zalijepite kopirani link u polje za Google Maps na formi za
								kreiranje susreta
							</li>
						</ol>
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
