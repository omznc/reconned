import { useExtracted } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

interface ErrorPageProps {
	title: string;
	link?: string;
	linkText?: string;
}

export function ErrorPage(props: ErrorPageProps) {
	const t = useExtracted();
	return (
		<div className="flex flex-col items-center gap-8 justify-center min-h-[500px] size-full">
			<h1 className="text-4xl">{props.title}</h1>
			<Button asChild>
				<Link href={props.link || "/"}>{props.linkText || t("Return to homepage")}</Link>
			</Button>
		</div>
	);
}

interface NoAccessPageProps {
	link?: string;
	linkText?: string;
}

export function NoAccessPage(props: NoAccessPageProps) {
	const t = useExtracted();
	return <ErrorPage title={t("You have no access to this page")} link={props.link} linkText={props.linkText} />;
}
