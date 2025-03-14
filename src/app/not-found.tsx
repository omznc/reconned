import { getLocale } from "next-intl/server";
import "./[locale]/globals.css";
import { redirect } from "@/i18n/navigation";

export default async function NotFound() {
	const locale = await getLocale();
	return redirect({ href: "/", locale }); // Redirect to the home page
}
