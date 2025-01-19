import { BadgeSoon } from "@/components/badge-soon";
import { env } from "@/lib/env";
import Link from "next/link";

export function Footer() {
	return (
		<footer className="w-full p-8 flex-col opacity-80 group hover:opacity-100 transition-all md:flex-row flex items-center justify-evenly bg-sidebar border-t">
			<div className="container z-10 mx-auto px-4 py-8">
				<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
					<div>
						<h3 className="font-bold mb-4">O nama</h3>
						<p className="text-sm ">
							RECONNED je nova platforma za airsoft entuzijaste. Otkrijte
							klubove, susrete, i igrače, širom Bosne i Hercegovine. Vodite svoj
							klub, organizujte susrete, i pronađite nove prilike. RECONNED je
							projekt napravljen od strane 2 airsoft igrača iz BIH -{" "}
							<Link
								className="text-red-500 hover:text-red-400 transition-colors"
								href="https://safetpojskic.com?utm_source=reconned&utm_medium=footer"
							>
								Safet Pojskić
							</Link>{" "}
							i{" "}
							<Link
								className="text-red-500 hover:text-red-400 transition-colors"
								href="https://omarzunic.com?utm_source=reconned&utm_medium=footer"
							>
								Omar Zunić
							</Link>
							.
						</p>
					</div>
					<div>
						<h3 className="font-bold mb-4">Brzi linkovi</h3>
						<ul className="space-y-2 text-sm ">
							<li>
								<Link href="/events">Susreti</Link>
							</li>
							<li>
								<Link href="/dashboard">Aplikacija</Link>
							</li>
							<li>
								<Link href="/dashboard">Mapa</Link>
							</li>
							<li>
								<Link href="/dashboard">Pretraga</Link>
							</li>
							<li>
								<Link href="/about">O nama</Link>
							</li>
						</ul>
					</div>
					<div>
						<h3 className="font-bold mb-4">Zajednica</h3>
						<ul className="space-y-2 text-sm ">
							<li>
								<Link href="#">Discord</Link>
								<BadgeSoon className="ml-2" />
							</li>
							<li>
								<Link href="#">Facebook</Link>
								<BadgeSoon className="ml-2" />
							</li>
							<li>
								<Link href="#">Instagram</Link>
								<BadgeSoon className="ml-2" />
							</li>
						</ul>
					</div>
					<div>
						<h3 className="font-bold mb-4">Podrška</h3>
						<ul className="space-y-2 text-sm ">
							<li>
								<Link href="#">Kontakt</Link>
								<BadgeSoon className="ml-2" />
							</li>
							<li>
								<Link href="#">Česta pitanja</Link>
								<BadgeSoon className="ml-2" />
							</li>
							<li>
								<Link href="#">Pravila privatnosti</Link>
								<BadgeSoon className="ml-2" />
							</li>
						</ul>
					</div>
				</div>
				<div className="mt-8 pt-8 border-t border-border/10 text-center text-sm ">
					<p>© {new Date().getFullYear()} RECONNED. Sva prava zadržana.</p>
					<Link
						href="/sponsors"
						className="text-red-500 mt-2 hover:text-red-400"
					>
						Pogledajte naše sponzore i partnere

					</Link>
					{
						env.NEXT_PUBLIC_SOURCE_COMMIT && (
							<p className="font-mono mt-4 opacity-30">Verzija {env.NEXT_PUBLIC_SOURCE_COMMIT.slice(0, 7)}</p>
						)
					}
				</div>
			</div>
		</footer>
	);
}
