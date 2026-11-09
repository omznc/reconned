import {
	ArrowUpRightIcon,
	Calendar,
	Code2,
	LayoutDashboard,
	MapIcon,
	Search,
	ShieldQuestion,
	StarIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { BadgeSoon } from "@/components/badge-soon";
import { CookieSettingsButton } from "@/components/cookie-settings-button";
import { FooterDrawing } from "@/components/logos/drawings/footer-drawing";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";

const CURRENT_COMMIT = env.NEXT_PUBLIC_SOURCE_COMMIT;

function FooterVersion({ locale, commitDate }: { locale: string; commitDate: string | null }) {
	if (!(CURRENT_COMMIT && commitDate)) {
		return null;
	}

	return (
		<Link
			href={`https://github.com/omznc/reconned/commit/${CURRENT_COMMIT}`}
			target="_blank"
			className="font-mono mt-4 w-fit opacity-60 hover:opacity-100 flex items-center gap-1 transition-opacity"
		>
			Version {CURRENT_COMMIT.slice(0, 7)} (
			{new Date(commitDate).toLocaleDateString(locale, {
				year: "numeric",
				month: "long",
				day: "numeric",
			})}
			)
			<ArrowUpRightIcon className="w-4 h-4 -mt-0.5" />
		</Link>
	);
}

export function Footer({ locale, commitDate }: { locale: string; commitDate: string | null }) {
	const t = useExtracted();

	return (
		<footer className="relative w-full p-2 flex-col opacity-80 group hover:opacity-100 transition-opacity md:flex-row flex items-center justify-evenly bg-sidebar border-t">
			<div className="container z-10 mx-auto px-4 py-8">
				<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
					<div>
						<h3 className="font-bold mb-4">{t("About us")}</h3>
						<p className="text-sm ">
							{t(
								"RECONNED is a new platform for airsoft enthusiasts. Discover clubs, events, and players across the world. Manage your club, organize events, and find new opportunities.",
							)}
						</p>
					</div>
					<div>
						<h3 className="font-bold mb-4">{t("Quick links")}</h3>
						<ul className="space-y-2 text-sm">
							<li>
								<Link
									href="/#about-us"
									className="flex items-center hover:text-red-500 transition-colors"
								>
									<ShieldQuestion className="w-5 h-5 mr-2" />
									{t("About us")}
								</Link>
							</li>
							<li>
								<Link href="/events" className="flex items-center hover:text-red-500 transition-colors">
									<Calendar className="w-5 h-5 mr-2" />
									{t("Events")}
								</Link>
							</li>
							<li>
								<Link
									href="/dashboard"
									className="flex items-center hover:text-red-500 transition-colors"
								>
									<LayoutDashboard className="w-5 h-5 mr-2" />
									{t("Dashboard")}
								</Link>
							</li>
							<li>
								<Link href="/map" className="flex items-center hover:text-red-500 transition-colors">
									<MapIcon className="w-5 h-5 mr-2" />
									{t("Map")}
								</Link>
							</li>
							<li>
								<Link href="/search" className="flex items-center hover:text-red-500 transition-colors">
									<Search className="w-5 h-5 mr-2" />
									{t("Search")}
								</Link>
							</li>{" "}
							<li>
								<Link
									href="/sponsors"
									className="flex items-center hover:text-red-500 transition-colors"
								>
									<StarIcon className="w-5 h-5 mr-2" />
									{t("Sponsors")}
								</Link>
							</li>
							<li>
								<Link
									href="/developers"
									className="flex items-center hover:text-red-500 transition-colors"
								>
									<Code2 className="w-5 h-5 mr-2" />
									{t("For developers")}
								</Link>
							</li>
							{/* <li>
								<Link
									href="/stats"
									target="_blank"
									className="flex items-center hover:text-red-500 transition-colors"
								>
									<BarChart2 className="w-5 h-5 mr-2" />
									{t("Statistics")}
								</Link>
							</li> */}
						</ul>
					</div>
					<div>
						<h3 className="font-bold mb-4">{t("Community")}</h3>
						<ul className="space-y-2 text-sm">
							<li>
								<Link
									target="_blank"
									href="https://discord.gg/fANDrYmFSy"
									className="hover:text-red-500 transition-colors flex items-center gap-2"
								>
									{/*<Discord className="size-4" />*/}
									<span>Discord</span>
								</Link>
							</li>
							<li>
								<Link
									target="_blank"
									href="https://instagram.com/reconnedairsoft?utm_source=reconned.com"
									className="hover:text-red-500 transition-colors flex items-center gap-2"
								>
									<span>Instagram</span>
								</Link>
							</li>
							<li>
								<Link
									target="_blank"
									href="https://github.com/omznc/reconned?utm_source=reconned.com"
									className="hover:text-red-500 transition-colors flex items-center gap-2"
								>
									<span>GitHub</span>
								</Link>
							</li>
							<li>
								<Link
									href="https://www.facebook.com/profile.php?id=61572533350106"
									className="hover:text-red-500 transition-colors flex items-center gap-2"
								>
									<span>Facebook</span>
								</Link>
							</li>
						</ul>
					</div>
					<div>
						<h3 className="font-bold mb-4">{t("Support")}</h3>
						<ul className="space-y-2 text-sm ">
							{/* Not links yet: a href="#" reads as navigation to assistive tech and goes nowhere.
							    The "soon" badge already carries the meaning; make them links when the pages exist. */}
							<li>
								<span className="text-muted-foreground">{t("Contact")}</span>
								<BadgeSoon className="ml-2" />
							</li>
							<li>
								<span className="text-muted-foreground">{t("FAQ")}</span>
								<BadgeSoon className="ml-2" />
							</li>
							<li>
								<Link href="/privacy-policy">{t("Privacy")}</Link>
							</li>
							<li>
								<Link href="/terms-of-use">{t("Terms of Use")}</Link>
							</li>
							<li>
								<CookieSettingsButton label={t("Cookie settings")} />
							</li>
							<li>
								<a
									href="/sitemap.xml"
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center hover:text-red-500 transition-colors"
								>
									{t("Sitemap")}
								</a>
							</li>
						</ul>
					</div>
				</div>
				<div className="mt-8 pt-8 border-t border-border/10 text-center text-sm flex flex-col items-center">
					<p>© RECONNED, {new Date().getFullYear()} </p>
					<Link href="/sponsors" className="text-red-500 font-bold mt-2 hover:text-red-400">
						{t("Check out our sponsors and partners")}
					</Link>
					<FooterVersion locale={locale} commitDate={commitDate} />
				</div>
			</div>
			<FooterDrawing className="opacity-50 absolute bottom-30 md:bottom-0 right-0 w-full max-w-[250px] 2xl:max-w-[350px] dark:invert pointer-events-none" />
		</footer>
	);
}
