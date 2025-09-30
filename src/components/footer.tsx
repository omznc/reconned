import { SiDiscord, SiFacebook, SiGithub, SiInstagram } from "@icons-pack/react-simple-icons";
import { BarChart2, Calendar, LayoutDashboard, MapIcon, Search, ShieldQuestion } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BadgeNew } from "@/components/badge-new";
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
	const t = await getTranslations();
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
						<h3 className="font-bold mb-4">{t("components.footer.about.title")}</h3>
						<p className="text-sm ">{t("components.footer.about.description")}</p>
					</div>
					<div>
						<h3 className="font-bold mb-4">{t("components.footer.quickLinks.title")}</h3>
						<ul className="space-y-2 text-sm">
							<li>
								<Link href="/about" className="flex items-center hover:text-red-500 transition-all">
									<ShieldQuestion className="w-5 h-5 mr-2" />
									{t("components.footer.quickLinks.about")} 👀
								</Link>
							</li>
							<li>
								<Link href="/events" className="flex items-center hover:text-red-500 transition-all">
									<Calendar className="w-5 h-5 mr-2" />
									{t("components.footer.quickLinks.events")}
								</Link>
							</li>
							<li>
								<Link href="/dashboard" className="flex items-center hover:text-red-500 transition-all">
									<LayoutDashboard className="w-5 h-5 mr-2" />
									{t("components.footer.quickLinks.dashboard")}
								</Link>
							</li>
							<li>
								<Link href="/map" className="flex items-center hover:text-red-500 transition-all">
									<MapIcon className="w-5 h-5 mr-2" />
									{t("components.footer.quickLinks.map")}
								</Link>
							</li>
							<li>
								<Link href="/search" className="flex items-center hover:text-red-500 transition-all">
									<Search className="w-5 h-5 mr-2" />
									{t("components.footer.quickLinks.search")}
								</Link>
							</li>
							<li>
								<Link
									href="/stats"
									target="_blank"
									className="flex items-center hover:text-red-500 transition-all"
								>
									<BarChart2 className="w-5 h-5 mr-2" />
									{t("components.footer.quickLinks.stats")}
								</Link>
							</li>
						</ul>
					</div>
					<div>
						<h3 className="font-bold mb-4">{t("components.footer.community.title")}</h3>
						<ul className="space-y-2 text-sm">
							<Link
								target="_blank"
								href="https://discord.gg/fANDrYmFSy"
								className="hover:text-red-500 transition-all flex items-center gap-2"
							>
								<SiDiscord className="size-4" />
								<span>Discord</span>
							</Link>
							<Link
								target="_blank"
								href="https://instagram.com/reconnedairsoft?utm_source=reconned.com"
								className="hover:text-red-500 transition-all flex items-center gap-2"
							>
								<SiInstagram className="size-4" />
								<span>Instagram</span>
							</Link>
							<Link
								target="_blank"
								href="https://github.com/omznc/reconned?utm_source=reconned.com"
								className="hover:text-red-500 transition-all flex items-center gap-2"
							>
								<SiGithub className="size-4" />
								<span>Github</span>
								<BadgeNew className="-mb-0.5" />
							</Link>
							<Link href="#" className="hover:text-red-500 transition-all flex items-center gap-2">
								<SiFacebook className="size-4" />
								<span>Facebook</span>
								<BadgeSoon className="-mb-0.5" />
							</Link>
						</ul>
					</div>
					<div>
						<h3 className="font-bold mb-4">{t("components.footer.support.title")}</h3>
						<ul className="space-y-2 text-sm ">
							<li>
								<Link href="#">{t("components.footer.support.contact")}</Link>
								<BadgeSoon className="ml-2" />
							</li>
							<li>
								<Link href="#">{t("components.footer.support.faq")}</Link>
								<BadgeSoon className="ml-2" />
							</li>
							<li>
								<Link href="/privacy-policy">{t("components.footer.support.privacy")}</Link>
							</li>
							<li>
								<Link href="/terms-of-use">{t("components.footer.support.terms")}</Link>
							</li>
							<li>
								<Link href="/changelog">{t("components.footer.support.changelog")}</Link>
								<BadgeNew className="ml-2" />
							</li>
						</ul>
					</div>
				</div>
				<div className="mt-8 pt-8 border-t border-border/10 text-center text-sm ">
					<p>© RECONNED, {new Date().getFullYear()} </p>
					<Link href="/sponsors" className="text-red-500 font-bold mt-2 hover:text-red-400">
						{t("components.footer.sponsors")}
					</Link>
					{CURRENT_COMMIT && body.commit?.committer?.date && (
						<p className="font-mono mt-4 opacity-30">
							{t("components.footer.version", {
								commit: CURRENT_COMMIT.slice(0, 7),
								date: new Date(body.commit.committer.date).toLocaleDateString(locale, {
									year: "numeric",
									month: "long",
									day: "numeric",
								}),
							})}
						</p>
					)}
				</div>
			</div>
			<FooterDrawing className="transition-all opacity-50 absolute bottom-30 md:bottom-0 right-0 w-full max-w-[250px] 2xl:max-w-[350px] dark:invert pointer-events-none" />
		</footer>
	);
}
