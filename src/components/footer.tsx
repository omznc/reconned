import { LogoTvrdjava } from "@/app/(public)/logo-tvrdjava";
import { LogoVeis } from "@/app/(public)/logo-veis";
import Link from "next/link";

export function Footer() {
	return (
		<footer className="w-full p-8 flex items-center justify-center bg-neutral-50 border-t">
			<div className="flex flex-col items-center gap-4">
				<h4 className="text-md font-semibold">Powered by</h4>
				<div className="flex items-center gap-4">
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
