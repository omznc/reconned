import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]">) {
	const params = await props.params;
	const locale = await getLocale();

	return redirect({
		href: `/dashboard/${params.clubId}/club`,
		locale,
	});
}
