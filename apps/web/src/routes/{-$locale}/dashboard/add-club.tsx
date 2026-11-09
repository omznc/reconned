import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { CirclePlus, MailPlus, Search } from "lucide-react";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { ErrorPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import { Button } from "@/components/ui/button";
import { Link, redirect } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { ClubInfoForm } from "@/routes/{-$locale}/dashboard/$clubId/club/information/-components/club-info.form";
import { RequestAccessForm } from "@/routes/{-$locale}/dashboard/add-club/-components/request-access.form";

const getCountriesFn = createServerFn({ method: "GET" }).handler(async () => {
	const { data, error } = await apiServer.GET("/api/countries");
	return error || !data ? null : data;
});

export const Route = createFileRoute("/{-$locale}/dashboard/add-club")({
	beforeLoad: ({ context }) => {
		if (!context.user) {
			throw redirect({ href: "/login?redirectTo=/dashboard/add-club", locale: context.locale });
		}
	},
	validateSearch: z.object({ type: z.coerce.string().optional() }),
	loader: async () => ({ countries: await getCountriesFn() }),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: AddClubPage,
});

function AddClubPage() {
	const t = useExtracted();
	const { type } = Route.useSearch();
	const { countries } = Route.useLoaderData();

	if (!countries) {
		return <ErrorPage title={t("An error occurred")} />;
	}

	if (type === "invite") {
		return (
			<div className="space-y-4">
				<h3 className="text-lg font-semibold">{t("Request club access")}</h3>
				<p className="text-muted-foreground">{t("Select the club you want to join")}</p>
				<RequestAccessForm />
			</div>
		);
	}

	if (type === "new") {
		return <ClubInfoForm countries={countries} />;
	}
	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("Add club")}</h3>
			</div>
			<div className="flex flex-col gap-4 w-full">
				<div className="flex flex-col gap-2">
					<Button asChild={true}>
						<Link href="?type=new" className="flex items-center gap-2">
							<CirclePlus />
							{t("Create new club")}
						</Link>
					</Button>
					<span className="text-gray-500">
						{t(
							"This option is for you if you want to create a new club, of which you will be the sole owner.",
						)}
					</span>
				</div>
				<div className="flex gap-1 items-center">
					<hr className="flex-1 border-t-2 border-gray-300" />
					<span className="text-gray-500">{t("or")}</span>
					<hr className="flex-1 border-t-2 border-gray-300" />
				</div>
				<div className="flex flex-col gap-2">
					<Button asChild={true}>
						<Link href="?type=invite" className="flex items-center gap-2">
							<MailPlus />
							{t("Join club")}
						</Link>
					</Button>
					<span className="text-gray-500">
						{t(
							"Your club is already on this site? You can request an invitation, or accept one you've already received.",
						)}
					</span>
				</div>
				<div className="flex gap-1 items-center">
					<hr className="flex-1 border-t-2 border-gray-300" />
					<span className="text-gray-500">{t("or")}</span>
					<hr className="flex-1 border-t-2 border-gray-300" />
				</div>
				<div className="flex flex-col gap-2 rounded-lg border border-dashed border-gray-300 p-4">
					<div className="flex items-center gap-2 text-lg font-medium">
						<Search className="h-5 w-5" />
						{t("Your club exists but you didn't add it?")}
					</div>
					<p className="text-sm text-muted-foreground">
						{t("If your club is on RECONNED but it's not claimed, you can claim it by going to its page.")}
					</p>
					<Button asChild={true} variant="outline">
						<Link href="/search" className="flex items-center gap-2">
							{t("Go to search page")}
						</Link>
					</Button>
				</div>
			</div>
		</>
	);
}
