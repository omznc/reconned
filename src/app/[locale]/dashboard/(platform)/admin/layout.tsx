import type { ReactNode } from "react";
import { ErrorPageWithTranslation } from "@/components/error-page";
import { isAuthenticated } from "@/lib/auth";

export default async function Layout(props: { children: ReactNode }) {
	const user = await isAuthenticated();
	if (user?.role !== "admin") {
		return <ErrorPageWithTranslation titleKey="dashboard.admin.noAccess" />;
	}

	return props.children;
}
