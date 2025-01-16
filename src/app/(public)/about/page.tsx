import Link from "next/link";
import { Logo } from "@/components/logos/logo";


export default function Home() {
	return (
		<>
			<div className="overflow-hidden flex items-center justify-center w-full">
				<div className="container mx-auto px-4 py-24 max-w-[1200px]">
					<div className="relative max-w-2xl">
						<h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
							Tko smo mi?
						</h1>
						<p className="text-xl text-text/80 mb-8">
							Mi smo dva programera iz Bosne i Hercegovine koji su odlučili da
							prebace Airsoft događanja sa Facebook-a i Viber-a, na nešto
							"naše".
						</p>
					</div>
				</div>
			</div>

			<div className="flex flex-col size-full gap-8 max-w-[1200px] px-4 py-16">
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold">O platformi</h2>
					<p className="text-lg inline">
						Krajnji cilj <Logo className="h-4 w-auto mb-0.5" /> platforme je
						unifikacija airsoft zajednice u Bosni i Hercegovini, a možda i šire.
						Naša platforma omogućava klubovima da se predstave, organizuju
						susrete, i pronađu nove članove. Igračima omogućava da pronađu
						klubove, susrete, i igrače, sve na jednom mjestu.
					</p>
				</div>
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold">Održivost</h2>
					<p className="text-lg">
						Cilj nije, i nikada neće biti čista zarada. Svaki dio platforme će
						eventualno biti open-source, a samim tim i dostupan svima. Trenutno
						kompletno lično finansiramo razvoj platforme, ali ćemo dati
						klubovima i individuama šansu da pomognu u razvoju i održavanju, uz
						neke pogodnosti.{" "}
						<span className="font-bold">
							Glavne funkcionalnosti će uvijek biti besplatne za korištenje.
						</span>
					</p>
				</div>
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl font-bold">Kako pomoći?</h2>
					<p className="text-lg">
						Ako ste zainteresovani za pomoć u razvoju platforme, slobodno nas
						kontaktirajte. Pomoć u obliku marketinga, programiranja, te općenito
						sponsorstva je uvijek dobrodošla.{" "}
						<Link
							className="text-red-600"
							href="/sponsors"
						>
							Pogledajte listu sponzora.
						</Link>
					</p>
				</div>
			</div>
		</>
	);
}
