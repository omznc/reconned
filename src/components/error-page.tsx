import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ErrorPageProps {
	title: string;
	link?: string;
	linkText?: string;
}

export function ErrorPage(props: ErrorPageProps) {
	return (
		<div className="flex flex-col items-center gap-8 justify-center min-h-[500px] size-full">
			<h1 className="text-4xl">{props.title}</h1>
			<Button asChild>
				<Link href={props.link || "/"}>
					{props.linkText || "Povratak na početnu stranicu"}
				</Link>
			</Button>
		</div>
	);
}
