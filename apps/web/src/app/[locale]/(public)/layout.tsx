import { Footer } from "@/components/footer";
import { GoogleOneTap } from "@/components/google-one-tap";
import { Header } from "@/components/header";
import { PublicTopBanners } from "@/components/public-top-banners";

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
	const { locale } = await params;

	return (
		<>
			<div className="w-full min-h-screen flex flex-col items-center">
				<GoogleOneTap />
				<PublicTopBanners />
				<Header />
				<main className="grow size-full flex flex-col items-center">
					<div className="absolute -z-10 inset-0 bg-linear-to-b from-red-600/30 to-transparent h-[70dvh]" />
					{children}
				</main>
			</div>
			<Footer locale={locale} />
		</>
	);
}
