import { LogoTvrdjava } from "@/components/logos/logo-tvrdjava";
import { LogoVeis } from "@/components/logos/logo-veis";
import Link from "next/link";

export function Footer() {
	return (
		<footer className="w-full p-8 flex items-center justify-center bg-neutral-50 border-t">
			<div className="flex flex-col items-center gap-4">
				<div className="flex flex-col md:flex-row items-center pt-4 gap-2 md:gap-8">
					<Link href="#">
						<LogoTvrdjava className="h-[120px] -mt-4 w-auto" />
					</Link>
					<Link href="#">
						<LogoVeis className="h-[80px] w-auto fill-black" />
					</Link>
				</div>
			</div>
		</footer>
	);
}
