import { EventOverview } from "@/components/overviews/event-overview";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NotFoundTemporary from "@/app/[locale]/not-found";
import { getTranslations } from "next-intl/server";

interface PageProps {
	params: Promise<{
		id: string;
		locale: string;
	}>;
}

export const dynamic = "force-dynamic";

export default async function Page(props: PageProps) {
	const user = await isAuthenticated();
	const params = await props.params;

	const conditionalPrivateWhere = user
		? {
				OR: [
					{
						isPrivate: false,
					},
					{
						club: {
							members: {
								some: {
									userId: user?.id,
								},
							},
						},
					},
				],
			}
		: {
				isPrivate: false,
			};

	const event = await prisma.event.findFirst({
		where: {
			OR: [{ id: params.id }, { slug: params.id }],
			...conditionalPrivateWhere,
		},
		include: {
			_count: {
				select: {
					eventRegistration: true,
				},
			},
			rules: true,
		},
	});

	if (!event) {
		// TODO https://github.com/vercel/next.js/issues/63388
		// notFound();
		return <NotFoundTemporary />;
	}

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] py-8  px-4">
			<EventOverview event={event} />
		</div>
	);
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
	const params = await props.params;
	const user = await isAuthenticated();
	const t = await getTranslations("public.events.metadata");

	const event = await prisma.event.findFirst({
		where: {
			AND: [
				{
					OR: [{ id: params.id }, { slug: params.id }],
				},
				{
					OR: [
						{ isPrivate: false },
						{
							club: {
								members: {
									some: {
										userId: user?.id,
									},
								},
							},
						},
					],
				},
			],
		},
	});

	if (!event) {
		return notFound();
	}

	const ogUrl = new URL(`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/api/og/event`);
	ogUrl.searchParams.set("title", event.name);
	if (event.description) {
		ogUrl.searchParams.set("description", event.description);
	}
	ogUrl.searchParams.set("date", new Date(event.dateStart).toLocaleDateString("bs"));
	if (event?.image) {
		ogUrl.searchParams.set("image", event.image);
	}

	return {
		title: `${event.name} - RECONNED`,
		description: event.description.slice(0, 160) ?? t("description"),
		openGraph: {
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: event.name,
				},
			],
		},
		metadataBase: env.NEXT_PUBLIC_BETTER_AUTH_URL ? new URL(env.NEXT_PUBLIC_BETTER_AUTH_URL) : undefined,
	};
}
