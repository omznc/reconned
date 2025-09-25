import { Button } from "@components/ui/button";
import { getTranslations } from "next-intl/server";
import type { ContactPage, WithContext } from "schema-dts";
import JsonLdScript from "@/components/json-ld-script";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";

export const revalidate = 86_400; // 1 day

export default async function Page() {
	const t = await getTranslations();

	const supportPageSchema: WithContext<ContactPage> = {
		"@context": "https://schema.org",
		"@type": "ContactPage",
		"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/support-us`,
		name: t("public.supportUs.metadata.title"),
		description: t("public.supportUs.metadata.description"),
		url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/support-us`,
		mainEntity: {
			"@type": "Organization",
			name: "Reconned",
			url: env.NEXT_PUBLIC_BETTER_AUTH_URL,
			contactPoint: {
				"@type": "ContactPoint",
				contactType: "customer support",
				email: "mail@reconned.com",
				url: "mailto:mail@reconned.com",
			},
		},
		about: {
			"@type": "Thing",
			name: "Support",
			description: "Ways to support the Reconned platform development",
		},
	};

	return (
		<div className="flex flex-col gap-4">
			<JsonLdScript data={supportPageSchema} />
			<h1>{t("public.supportUs.title")}</h1>
			<Button type="button" variant="secondary">
				<Link href="/">{t("common.actions.back")}</Link>
			</Button>
		</div>
	);
}
