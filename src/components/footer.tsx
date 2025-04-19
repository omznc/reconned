import { BadgeSoon } from "@/components/badge-soon";
import { env } from "@/lib/env";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SiDiscord, SiFacebook, SiGithub, SiInstagram } from "@icons-pack/react-simple-icons";
// Removed QuickLinkIcon import and added required lucide icons.
import { Calendar, LayoutDashboard, MapIcon, Search, ShieldQuestion, BarChart2 } from "lucide-react";
import { BadgeNew } from "@/components/badge-new";
import Image from "next/image";
import FooterImage from "@public/footer.webp";

export function Footer() {
	const t = useTranslations("components.footer");

	return (
		<footer className="relative w-full p-2 flex-col opacity-80 group hover:opacity-100 transition-all md:flex-row flex items-center justify-evenly bg-sidebar border-t">
			<div className="container z-10 mx-auto px-4 py-8">
				<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
					<div>
						<h3 className="font-bold mb-4">{t("about.title")}</h3>
						<p className="text-sm ">{t("about.description")}</p>
					</div>
					<div>
						<h3 className="font-bold mb-4">{t("quickLinks.title")}</h3>
						<ul className="space-y-2 text-sm">
							<li>
								<Link href="/about" className="flex items-center hover:text-red-500 transition-all">
									<ShieldQuestion className="w-5 h-5 mr-2" />
									{t("quickLinks.about")} 👀
								</Link>
							</li>
							<li>
								<Link href="/events" className="flex items-center hover:text-red-500 transition-all">
									<Calendar className="w-5 h-5 mr-2" />
									{t("quickLinks.events")}
								</Link>
							</li>
							<li>
								<Link href="/dashboard" className="flex items-center hover:text-red-500 transition-all">
									<LayoutDashboard className="w-5 h-5 mr-2" />
									{t("quickLinks.dashboard")}
								</Link>
							</li>
							<li>
								<Link href="/map" className="flex items-center hover:text-red-500 transition-all">
									<MapIcon className="w-5 h-5 mr-2" />
									{t("quickLinks.map")}
								</Link>
							</li>
							<li>
								<Link href="/search" className="flex items-center hover:text-red-500 transition-all">
									<Search className="w-5 h-5 mr-2" />
									{t("quickLinks.search")}
								</Link>
							</li>
							<li>
								<Link
									href="/stats"
									target="_blank"
									className="flex items-center hover:text-red-500 transition-all"
								>
									<BarChart2 className="w-5 h-5 mr-2" />
									{t("quickLinks.stats")}
								</Link>
							</li>
						</ul>
					</div>
					<div>
						<h3 className="font-bold mb-4">{t("community.title")}</h3>
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
						<h3 className="font-bold mb-4">{t("support.title")}</h3>
						<ul className="space-y-2 text-sm ">
							<li>
								<Link href="#">{t("support.contact")}</Link>
								<BadgeSoon className="ml-2" />
							</li>
							<li>
								<Link href="#">{t("support.faq")}</Link>
								<BadgeSoon className="ml-2" />
							</li>
							<li>
								<Link href="/privacy-policy">{t("support.privacy")}</Link>
							</li>
							<li>
								<Link href="/terms-of-use">{t("support.terms")}</Link>
							</li>
							<li>
								<Link href="/changelog">{t("support.changelog")}</Link>
								<BadgeNew className="ml-2" />
							</li>
						</ul>
					</div>
				</div>
				<div className="mt-8 pt-8 border-t border-border/10 text-center text-sm ">
					<p>{t("copyright", { year: new Date().getFullYear() })}</p>
					<Link href="/sponsors" className="text-red-500 font-bold mt-2 hover:text-red-400">
						{t("sponsors")}
					</Link>
					{env.NEXT_PUBLIC_SOURCE_COMMIT && (
						<p className="font-mono mt-4 opacity-30">
							{t("version", {
								commit: env.NEXT_PUBLIC_SOURCE_COMMIT.slice(0, 7),
							})}
						</p>
					)}
				</div>
			</div>
			<Image
				priority={false}
				loading="lazy"
				src={FooterImage}
				alt="Footer image of a person looking up at his laptop while it's flying away."
				draggable={false}
				className="transition-all opacity-50 absolute bottom-30 md:bottom-0 right-0 w-full max-w-[250px] 2xl:max-w-[350px] dark:invert pointer-events-none"
			/>
		</footer>
	);
}
