import { Button } from "@/components/ui/button";
import { Frown } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
	return (
		<html lang="en">
			<body>
				<main className="flex fade-in-up flex-col items-center justify-between p-24">
					<Frown className="size-24 mb-4" />
					<h1 className="text-4xl font-bold mb-4 text-center">
						Izgubili ste se
					</h1>
					<p className="text-lg mb-8 text-center">Stranica nije pronađena</p>
					<Button asChild={true}>
						<Link
							href="/"
							className="text-lg text-center hover:bg-accent transition-all bg-background px-4 py-2 rounded-md border"
						>
							Vrati se na početnu stranicu
						</Link>
					</Button>
				</main>
			</body>
		</html>
	);
}
