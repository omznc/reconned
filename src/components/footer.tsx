import { LogoVeis } from "@/components/logos/logo-veis";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function Footer() {
	return (
		<footer className="w-full p-8 flex-col opacity-80 group hover:opacity-100 transition-all md:flex-row flex items-center justify-evenly bg-sidebar border-t">
			<div className="flex flex-col items-center gap-4">
				<div className="flex flex-col items-center md:items-start justify-center md:justify-start gap-2">
					Sva prava zadržana
					<div className="flex md:flex-col flex-row gap-2">
						<Link
							href="https://omarzunic.com?utm_source=airsoftbih"
							className="flex items-center gap-1 font-semibold"
						>
							Omar Žunić <ArrowUpRight size={16} />
						</Link>
						<Link
							href="https://safetpojskic.com?utm_source=airsoftbih"
							className="flex items-center gap-1 font-semibold"
						>
							Safet Pojskić <ArrowUpRight size={16} />
						</Link>
					</div>
				</div>
			</div>
			<div className="flex flex-col items-center gap-4 mt-6 md:mt-0">
				Projekt realizovan uz podršku
				<div className="flex flex-col md:flex-row items-center  gap-2 md:gap-8">
					{/* <Link href="#">
						<LogoTvrdjava className="h-[120px] -mt-4 w-auto" />
					</Link> */}
					<Link href="https://www.instagram.com/veis.livno/">
						<LogoVeis className="h-[80px] w-auto" />
					</Link>
				</div>
			</div>

			<div className="flex flex-col items-end gap-4 mt-6 md:mt-0">
				<div className="flex md:flex-col flex-row gap-2">
					<span>TODO</span>
					<span>TODO</span>
				</div>
			</div>
		</footer>
	);
}
