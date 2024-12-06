import { ErrorPage } from "@/components/error-page";
import { isAuthenticated } from "@/lib/auth";
import type { ReactNode } from "react";

export default async function Layout(props: { children: ReactNode }) {
	const user = await isAuthenticated();
	if (user?.role !== "admin") {
		return <ErrorPage title="Nemate pristup ovoj stranici" />;
	}

	return props.children;
}
