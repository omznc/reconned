import { BadgeSoon } from "@/components/badge-soon";
import { env } from "@/lib/env";
import { useTranslations } from "next-intl";
import Link from "next/link";

export function Footer() {
	const t = useTranslations("components.footer");

	return (
		<footer className="w-full p-8 flex-col opacity-80 group hover:opacity-100 transition-all md:flex-row flex items-center justify-evenly bg-sidebar border-t">
			<div className="container z-10 mx-auto px-4 py-8">
				<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
					<div>
						<h3 className="font-bold mb-4">{t("about.title")}</h3>
						<p className="text-sm ">
							{t.rich("about.description", {
								omar: () => (
									<Link
										className="text-red-500 hover:text-red-400 transition-colors"
										href="https://omarzunic.com?utm_source=reconned&utm_medium=footer"
									>
										Omar Zunić
									</Link>
								),
								safet: () => (
									<Link
										className="text-red-500 hover:text-red-400 transition-colors"
										href="https://safetpojskic.com?utm_source=reconned&utm_medium=footer"
									>
										Safet Pojskić
									</Link>
								),
							})}
						</p>
					</div>
					<div>
						<h3 className="font-bold mb-4">{t("quickLinks.title")}</h3>
						<ul className="space-y-2 text-sm ">
							<li>
								<Link href="/events">{t("quickLinks.events")}</Link>
							</li>
							<li>
								<Link href="/dashboard">{t("quickLinks.dashboard")}</Link>
							</li>
							<li>
								<Link href="/map">{t("quickLinks.map")}</Link>
							</li>
							<li>
								<Link href="/search">{t("quickLinks.search")}</Link>
							</li>
							<li>
								<Link href="/about">{t("quickLinks.about")}</Link>
							</li>
							<li>
								<Link href="/stats" target="_blank">{t("quickLinks.stats")}</Link>
							</li>
						</ul>
					</div>
					<div>
						<h3 className="font-bold mb-4">{t("community.title")}</h3>
						<ul className="space-y-2 text-sm ">
							<li>
								<Link href="https://discord.gg/fANDrYmFSy">Discord</Link>
							</li>
							<li>
								<Link href="#">Facebook</Link>
								<BadgeSoon className="ml-2" />
							</li>
							<li>
								<Link href="#">Instagram</Link>
								<BadgeSoon className="ml-2" />
							</li>
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
								<Link href="#">{t("support.privacy")}</Link>
								<BadgeSoon className="ml-2" />
							</li>
						</ul>
					</div>
				</div>
				<div className="mt-8 pt-8 border-t border-border/10 text-center text-sm ">
					<p>{t("copyright", { year: new Date().getFullYear() })}</p>
					<Link
						href="/sponsors"
						className="text-red-500 font-bold mt-2 hover:text-red-400"
					>
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
		</footer>
	);
}
