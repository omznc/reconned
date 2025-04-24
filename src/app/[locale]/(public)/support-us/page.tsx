import { Button } from "@components/ui/button";
import { Link } from "@/i18n/navigation";

export const revalidate = 86_400; // 1 day

export default function Page() {
	return (
		<div className="flex flex-col gap-4">
			<h1>Coming soon</h1>
			<Button type="button" variant="secondary">
				<Link href="/">Idi Nazad</Link>
			</Button>
		</div>
	);
}
