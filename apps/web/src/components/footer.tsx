import {
	ArrowUpRightIcon,
	Calendar,
	Facebook,
	Github,
	Instagram,
	LayoutDashboard,
	MapIcon,
	Search,
	ShieldQuestion,
	StarIcon,
} from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";
import { BadgeSoon } from "@/components/badge-soon";
import { FooterDrawing } from "@/components/logos/drawings/footer-drawing";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";

const CURRENT_COMMIT = env.NEXT_PUBLIC_SOURCE_COMMIT;
type CommitResponse = {
	commit?: {
		committer?: {
			date?: string;
		};
	};
};

export async function Footer() {
	const t = await getExtracted();
	const locale = await getLocale();

	const commitDateResponse = await fetch(`https://api.github.com/repos/omznc/reconned/commits/${CURRENT_COMMIT}`, {
		cache: "force-cache",
		next: {
			revalidate: false,
		},
	});
	const body: CommitResponse = await commitDateResponse.json();

	return (
		<footer className="relative w-full p-2 flex-col opacity-80 group hover:opacity-100 transition-all md:flex-row flex items-center justify-evenly bg-sidebar border-t">
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
								<Link href="/about" className="flex items-center hover:text-red-500 transition-all">
									<ShieldQuestion className="w-5 h-5 mr-2" />
									{t("About us")}
								</Link>
							</li>
							<li>
								<Link href="/events" className="flex items-center hover:text-red-500 transition-all">
									<Calendar className="w-5 h-5 mr-2" />
									{t("Events")}
								</Link>
							</li>
							<li>
								<Link href="/dashboard" className="flex items-center hover:text-red-500 transition-all">
									<LayoutDashboard className="w-5 h-5 mr-2" />
									{t("Dashboard")}
								</Link>
							</li>
							<li>
								<Link href="/map" className="flex items-center hover:text-red-500 transition-all">
									<MapIcon className="w-5 h-5 mr-2" />
									{t("Map")}
								</Link>
							</li>
							<li>
								<Link href="/search" className="flex items-center hover:text-red-500 transition-all">
									<Search className="w-5 h-5 mr-2" />
									{t("Search")}
								</Link>
							</li>{" "}
							<li>
								<Link href="/sponsors" className="flex items-center hover:text-red-500 transition-all">
									<StarIcon className="w-5 h-5 mr-2" />
									{t("Sponsors")}
								</Link>
							</li>
							{/* <li>
								<Link
									href="/stats"
									target="_blank"
									className="flex items-center hover:text-red-500 transition-all"
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
									className="hover:text-red-500 transition-all flex items-center gap-2"
								>
									{/*<Discord className="size-4" />*/}
									<span>Discord</span>
								</Link>
							</li>
							<li>
								<Link
									target="_blank"
									href="https://instagram.com/reconnedairsoft?utm_source=reconned.com"
									className="hover:text-red-500 transition-all flex items-center gap-2"
								>
									<Instagram className="size-4" />
									<span>Instagram</span>
								</Link>
							</li>
							<li>
								<Link
									target="_blank"
									href="https://github.com/omznc/reconned?utm_source=reconned.com"
									className="hover:text-red-500 transition-all flex items-center gap-2"
								>
									<Github className="size-4" />
									<span>Github</span>
								</Link>
							</li>
							<li>
								<Link
									href="https://www.facebook.com/profile.php?id=61572533350106"
									className="hover:text-red-500 transition-all flex items-center gap-2"
								>
									<Facebook className="size-4" />
									<span>Facebook</span>
								</Link>
							</li>
						</ul>
					</div>
					<div>
						<h3 className="font-bold mb-4">{t("Support")}</h3>
						<ul className="space-y-2 text-sm ">
							<li>
								<Link href="#">{t("Contact")}</Link>
								<BadgeSoon className="ml-2" />
							</li>
							<li>
								<Link href="#">{t("FAQ")}</Link>
								<BadgeSoon className="ml-2" />
							</li>
							<li>
								<Link href="/privacy-policy">{t("Privacy")}</Link>
							</li>
							<li>
								<Link href="/terms-of-use">{t("Terms of Use")}</Link>
							</li>
							<li>
								<Link href="/changelog">{t("Changelog")}</Link>
							</li>
						</ul>
					</div>
				</div>
				<div className="mt-8 pt-8 border-t border-border/10 text-center text-sm flex flex-col items-center">
					<p>© RECONNED, {new Date().getFullYear()} </p>
					<Link href="/sponsors" className="text-red-500 font-bold mt-2 hover:text-red-400">
						{t("Check out our sponsors and partners")}
					</Link>
					{CURRENT_COMMIT && body.commit?.committer?.date && (
						<Link
							href={`https://github.com/omznc/reconned/commit/${CURRENT_COMMIT}`}
							target="_blank"
							className="font-mono mt-4 w-fit opacity-30 hover:opacity-60 flex items-center gap-1 transition-opacity"
						>
							{t("Version {commit} ({date})", {
								commit: CURRENT_COMMIT.slice(0, 7),
								date: new Date(body.commit.committer.date).toLocaleDateString(locale, {
									year: "numeric",
									month: "long",
									day: "numeric",
								}),
							})}
							<ArrowUpRightIcon className="w-4 h-4 -mt-0.5" />
						</Link>
					)}
				</div>
			</div>
			<FooterDrawing className="transition-all opacity-50 absolute bottom-30 md:bottom-0 right-0 w-full max-w-[250px] 2xl:max-w-[350px] dark:invert pointer-events-none" />
		</footer>
	);
}
