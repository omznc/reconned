import { CirclePlus, MailPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ClubInfoForm } from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.form";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCountries } from "@/lib/cached-countries";
import { RequestAccessForm } from "./_components/request-access.form.tsx";

interface PageProps {
	searchParams: Promise<{
		type?: "invite" | "new" | string;
	}>;
}

export default async function Page(props: PageProps) {
	const searchParams = await props.searchParams;
	const countries = await getCountries();
	const t = await getTranslations();
	const type = searchParams.type;

	if (type === "invite") {
		return (
			<div className="space-y-4">
				<h3 className="text-lg font-semibold">{t("dashboard.addClub.requestAccess")}</h3>
				<p className="text-muted-foreground">{t("dashboard.addClub.requestAccessDescription")}</p>
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
				<h3 className="text-lg font-semibold">{t("dashboard.addClub.addClub")}</h3>
			</div>
			<div className="flex flex-col gap-4 w-full">
				<div className="flex flex-col gap-2">
					<Button asChild={true}>
						<Link href="?type=new" className="flex items-center gap-2">
							<CirclePlus />
							{t("dashboard.addClub.createClub")}
						</Link>
					</Button>
					<span className="text-gray-500">{t("dashboard.addClub.createClubDescription")}</span>
				</div>
				<div className="flex gap-1 items-center">
					<hr className="flex-1 border-t-2 border-gray-300" />
					<span className="text-gray-500">{t("dashboard.addClub.or")}</span>
					<hr className="flex-1 border-t-2 border-gray-300" />
				</div>
				<div className="flex flex-col gap-2">
					<Button asChild={true}>
						<Link href="?type=invite" className="flex items-center gap-2">
							<MailPlus />
							{t("dashboard.addClub.joinClub")}
						</Link>
					</Button>
					<span className="text-gray-500">{t("dashboard.addClub.joinClubDescription")}</span>
				</div>
			</div>
		</>
	);
}
