import { CirclePlus, MailPlus, Search } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { ClubInfoForm } from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.form";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCountries } from "@/lib/cached-countries";
import { RequestAccessForm } from "./_components/request-access.form.tsx";

export default async function Page(props: PageProps<"/[locale]/dashboard/add-club">) {
	const searchParams = await props.searchParams;
	const countries = await getCountries();
	const t = await getExtracted();
	const type = searchParams.type as "invite" | "new" | string;

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
