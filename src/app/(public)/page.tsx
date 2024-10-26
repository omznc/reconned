import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";

export default async function Home() {
	const user = await isAuthenticated();

	return (
		<div className="flex flex-col size-full gap-8">
			I don't know what to have here
			<Link href="/events" className="underline">
				heres all the events
			</Link>
		</div>
	);
}
