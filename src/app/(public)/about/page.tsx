import Link from "next/link";
import { Logo } from "@/components/logos/logo";
import { getTranslations } from "next-intl/server";

export default async function Home() {
	const t = await getTranslations('public.about');

	return (
		<>
			<div className="overflow-hidden flex items-center justify-center w-full">
				<div className="container mx-auto px-4 py-24 max-w-[1200px]">
					<div className="relative max-w-2xl">
						<h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
							{t('title')}
						</h1>
						<p className="text-xl text-text/80 mb-8">
							{t('subtitle')}
						</p>
					</div>
				</div>
			</div>

			<div className="flex flex-col size-full gap-8 max-w-[1200px] px-4 py-16">
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold">{t('platform.title')}</h2>
					<p className="text-lg inline">
						{t.rich('platform.description', {
							logo: () => <Logo className="h-4 w-auto mb-0.5" />
						})}
					</p>
				</div>
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold">{t('sustainability.title')}</h2>
					<p className="text-lg">
						{t('sustainability.description')}{" "}
						<span className="font-bold">
							{t('sustainability.emphasis')}
						</span>
					</p>
				</div>
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold">{t('help.title')}</h2>
					<p className="text-lg">
						{t('help.description')}{" "}
						<Link
							className="text-red-600"
							href="/sponsors"
						>
							{t('help.sponsors')}
						</Link>
					</p>
				</div>
			</div>
		</>
	);
}
