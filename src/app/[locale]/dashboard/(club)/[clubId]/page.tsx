import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

interface PageProps {
	params: Promise<{
		clubId: string;
	}>;
}
export default async function Page(props: PageProps) {
	const params = await props.params;
	const locale = await getLocale();

	return redirect({
		href: `/dashboard/${params.clubId}/club`,
		locale,
	});
}
