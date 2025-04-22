import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, MailCheckIcon } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

const sponsors = [
	{
		name: "VEIS Livno",
		logo: "/veis-logo.svg",
		description: "Prvi livanjski airsoft klub",
		website: "https://instagram.com/veis.livno",
	},
	// {
	// 	name: "Savez Airsoft Klubova Federacije BiH",
	// 	logo: "/logo-savez.png",
	// 	description: "Jedini registrirani airsoft savez/udruga",
	// 	website: "https://www.facebook.com/airsoftsavez/",
	// },
] as {
	name: string;
	logo: string;
	logoDark?: string;
	description: string;
	website: string;
}[];

export default function SponsorsPage() {
	const t = useTranslations("public.sponsors");

	return (
		<>
			<div className="overflow-hidden flex items-center justify-center w-full">
				<div className="container mx-auto px-4 py-24 max-w-[1200px]">
					<div className="relative max-w-2xl">
						<h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">{t("title")}</h1>
						<p className="text-xl text-text/80 mb-8">{t("description")}</p>
					</div>
				</div>
			</div>

			<div className="flex flex-col size-full gap-16 max-w-[1200px] px-4 py-16">
				<section>
					<h2 className="text-3xl font-bold mb-8">{t("currentSponsors")}</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
						{sponsors.map((sponsor) => (
							<Link target="_blank" key={sponsor.name} href={sponsor.website} className="h-full group">
								<Card className="relative h-full flex flex-col justify-between group-hover:border-red-500 border transition-all">
									<ArrowUpRight className="absolute top-4 right-4 w-6 h-6 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
									<CardHeader className="flex flex-col items-center">
										<Image
											src={sponsor.logo || "/placeholder.svg"}
											alt={sponsor.name}
											data-has-dark={!!sponsor.logoDark}
											width={200}
											height={100}
											className="mb-4 size-[200px] object-contain block dark:data-[has-dark=true]:hidden"
										/>
										{sponsor.logoDark && (
											<Image
												src={sponsor.logoDark}
												alt={sponsor.name}
												width={200}
												height={100}
												className="mb-4 size-[200px] object-contain hidden dark:block"
											/>
										)}
									</CardHeader>
									<CardContent className="flex flex-col gap-1">
										<CardTitle>{sponsor.name}</CardTitle>
										<p className="opacity-80">{sponsor.description}</p>
									</CardContent>
								</Card>
							</Link>
						))}
						<Link target="_blank" href={"mailto:mail@reconned.com"} className="h-full group">
							<Card className="relative h-full flex flex-col justify-between group-hover:border-red-500 border transition-all">
								<MailCheckIcon className="absolute top-4 right-4 w-6 h-6 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
								<CardHeader className="flex flex-col items-center">
									<Image
										src={"/reconned-logo-light.svg"}
										alt={"Vi"}
										data-has-dark={true}
										width={200}
										height={100}
										className="mb-4 size-[200px] object-contain block dark:data-[has-dark=true]:hidden"
									/>
									<Image
										src={"/reconned-logo-dark.svg"}
										alt={"Vi"}
										width={200}
										height={100}
										className="mb-4 size-[200px] object-contain hidden dark:block"
									/>
								</CardHeader>
								<CardContent className="flex flex-col gap-1">
									<CardTitle>{t("cta.title")}</CardTitle>
									<p className="opacity-80">{t("cta.description")}</p>
								</CardContent>
							</Card>
						</Link>
					</div>
				</section>

				<section>
					<h2 className="text-3xl font-bold mb-4">{t("contactUs")}</h2>
					<p className="text-lg">
						{t("contactDescription")}{" "}
						<Link
							href="mailto:mail@reconned.com"
							className="text-red-600 underline hover:text-red-400 transition-colors"
						>
							mail@reconned.com
						</Link>
						.
					</p>
				</section>
			</div>
		</>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("public");

	return {
		title: t("sponsors.metadata.title"),
		description: t("sponsors.metadata.description"),
		keywords: t("layout.metadata.keywords")
			.split(",")
			.map((keyword) => keyword.trim()),
	};
}
