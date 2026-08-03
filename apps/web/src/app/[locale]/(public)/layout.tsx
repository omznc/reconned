import { getExtracted, setRequestLocale } from "next-intl/server";
import { Footer } from "@/components/footer";
import { GoogleOneTap } from "@/components/google-one-tap";
import { Header } from "@/components/header";
import { PublicTopBanners } from "@/components/public-top-banners";

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
	const { locale } = await params;
	// `setRequestLocale` first, or `getExtracted` resolves the locale from a request
	// header and opts the whole public subtree out of static rendering.
	setRequestLocale(locale);
	const t = await getExtracted();

	return (
		<>
			<div className="w-full min-h-screen flex flex-col items-center">
				<a
					href="#main-content"
					className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-100 focus-visible:rounded-md focus-visible:border focus-visible:bg-background focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					{t("Skip to content")}
				</a>
				<GoogleOneTap />
				<PublicTopBanners />
				<Header />
				<main id="main-content" className="grow size-full flex flex-col items-center">
					<div className="absolute -z-10 inset-0 bg-linear-to-b from-red-600/30 to-transparent h-[70dvh]" />
					{children}
				</main>
			</div>
			<Footer locale={locale} />
		</>
	);
}
