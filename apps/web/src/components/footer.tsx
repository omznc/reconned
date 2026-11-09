import {
	ArrowRight,
	ArrowUpRightIcon,
	Building2,
	Calendar,
	Code2,
	LayoutDashboard,
	MapIcon,
	Search,
	ShieldQuestion,
	StarIcon,
	Users,
} from "lucide-react";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";
import { BadgeSoon } from "@/components/badge-soon";
import { CookieSettingsButton } from "@/components/cookie-settings-button";
import { FacebookIcon, InstagramIcon } from "@/components/icons";
import { FooterDrawing } from "@/components/logos/drawings/footer-drawing";
import { Logo } from "@/components/logos/logo";
import type { Href, IconComponent } from "@/components/redesign/types";
import { Link } from "@/i18n/navigation";
import { DEFAULT_TIME_ZONE } from "@/i18n/routing";

type FooterCommit = { commit: string; date: string } | null;

const LINK_CLASS =
	"flex items-center gap-2 rounded-sm text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

function FooterVersion({ locale, version }: { locale: string; version: FooterCommit }) {
	if (!version) {
		return null;
	}

	return (
		<Link
			href={`https://github.com/omznc/reconned/commit/${version.commit}`}
			target="_blank"
			className="flex w-fit items-center gap-1 font-mono text-xs opacity-60 transition-opacity hover:opacity-100"
		>
			Version {version.commit.slice(0, 7)} (
			{/* The ICU data of the server runtime and of the browser can format the same date differently. */}
			<span suppressHydrationWarning>
				{new Date(version.date).toLocaleDateString(locale, {
					timeZone: DEFAULT_TIME_ZONE,
					year: "numeric",
					month: "long",
					day: "numeric",
				})}
			</span>
			)
			<ArrowUpRightIcon className="-mt-0.5 h-4 w-4" />
		</Link>
	);
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div>
			<h3 className="mb-3 text-[15px] font-semibold">{title}</h3>
			<ul className="flex flex-col gap-2">{children}</ul>
		</div>
	);
}

function FooterLink({
	href,
	icon: Icon,
	external,
	children,
}: {
	href: Href;
	icon?: IconComponent;
	external?: boolean;
	children: ReactNode;
}) {
	return (
		<li>
			<Link href={href} target={external ? "_blank" : undefined} className={LINK_CLASS}>
				{Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
				{children}
			</Link>
		</li>
	);
}

export function Footer({ locale, version }: { locale: string; version: FooterCommit }) {
	const t = useExtracted();

	return (
		<footer className="relative w-full border-t bg-background">
			<div className="container relative z-10 mx-auto flex flex-col gap-8 px-4 pt-12 pb-7 sm:px-6">
				<div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
					<div className="flex flex-col gap-3">
						<Logo className="h-6 w-auto" />
						<p className="text-[13px] leading-5 text-muted-foreground">
							{t(
								"RECONNED is a new platform for airsoft enthusiasts. Discover clubs, events, and players across the world. Manage your club, organize events, and find new opportunities.",
							)}
						</p>
					</div>
					<FooterColumn title={t("Quick links")}>
						<FooterLink href="/#about-us" icon={ShieldQuestion}>
							{t("About us")}
						</FooterLink>
						<FooterLink href="/events" icon={Calendar}>
							{t("Events")}
						</FooterLink>
						<FooterLink href="/clubs" icon={Building2}>
							{t("Clubs")}
						</FooterLink>
						<FooterLink href="/users" icon={Users}>
							{t("Players")}
						</FooterLink>
						<FooterLink href="/dashboard" icon={LayoutDashboard}>
							{t("Dashboard")}
						</FooterLink>
						<FooterLink href="/map" icon={MapIcon}>
							{t("Map")}
						</FooterLink>
						<FooterLink href="/search" icon={Search}>
							{t("Search")}
						</FooterLink>
						<FooterLink href="/sponsors" icon={StarIcon}>
							{t("Sponsors")}
						</FooterLink>
						<FooterLink href="/developers" icon={Code2}>
							{t("For developers")}
						</FooterLink>
					</FooterColumn>
					<FooterColumn title={t("Community")}>
						<FooterLink href="https://discord.gg/fANDrYmFSy" icon={Users} external={true}>
							Discord
						</FooterLink>
						<FooterLink
							href="https://instagram.com/reconnedairsoft?utm_source=reconned.com"
							icon={InstagramIcon}
							external={true}
						>
							Instagram
						</FooterLink>
						<FooterLink
							href="https://github.com/omznc/reconned?utm_source=reconned.com"
							icon={Code2}
							external={true}
						>
							GitHub
						</FooterLink>
						<FooterLink href="https://www.facebook.com/profile.php?id=61572533350106" icon={FacebookIcon}>
							Facebook
						</FooterLink>
					</FooterColumn>
					<FooterColumn title={t("Support")}>
						{/* Not links yet: a href="#" reads as navigation to assistive tech and goes nowhere.
						    The "soon" badge already carries the meaning; make them links when the pages exist. */}
						<li className="text-[13px] text-muted-foreground">
							{t("Contact")}
							<BadgeSoon className="ml-2" />
						</li>
						<li className="text-[13px] text-muted-foreground">
							{t("FAQ")}
							<BadgeSoon className="ml-2" />
						</li>
						<FooterLink href="/privacy-policy">{t("Privacy")}</FooterLink>
						<FooterLink href="/terms-of-use">{t("Terms of Use")}</FooterLink>
						<li className="text-[13px] text-muted-foreground">
							<CookieSettingsButton label={t("Cookie settings")} />
						</li>
						<li>
							<a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
								{t("Sitemap")}
							</a>
						</li>
					</FooterColumn>
				</div>
				<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-xs">
					<p className="text-muted-foreground">© RECONNED, {new Date().getFullYear()}</p>
					<FooterVersion locale={locale} version={version} />
					<Link
						href="/sponsors"
						className="flex items-center gap-1.5 rounded-sm outline-none hover:text-brand focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						{t("Check out our sponsors and partners")}
						<ArrowRight className="size-3" aria-hidden />
					</Link>
				</div>
			</div>
			<FooterDrawing className="pointer-events-none absolute right-0 bottom-14 hidden w-full max-w-[250px] opacity-30 2xl:max-w-[350px] dark:invert lg:block" />
		</footer>
	);
}
