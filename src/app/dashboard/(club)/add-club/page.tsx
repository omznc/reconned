import { ClubInfoForm } from "@/app/dashboard/(club)/[clubId]/club/information/_components/club-info.form";
import { BadgeSoon } from "@/components/badge-soon";
import { Button } from "@/components/ui/button";
import { getCountries } from "@/lib/cached-countries";
import { CirclePlus, MailPlus } from "lucide-react";
import Link from "next/link";

interface PageProps {
	searchParams: Promise<{
		type?: "invite" | "new" | string;
	}>;
}

export default async function Page(props: PageProps) {
	const searchParams = await props.searchParams;
	const countries = await getCountries();
	const type = searchParams.type;
	if (type === "invite") {
		return <div>Invite</div>;
	}
	if (type === "new") {
		// @ts-ignore
		return <ClubInfoForm countries={countries} />;
	}
	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">Dodajte klub</h3>
			</div>
			<div className="flex flex-col gap-4 w-full">
				<div className="flex flex-col gap-2">
					<Button asChild={true}>
						<Link href="?type=new" className="flex items-center gap-2">
							<CirclePlus />
							Napravite novi klub
						</Link>
					</Button>
					<span className="text-gray-500">
						Ova opcija je za vas ako želite napraviti novi klub, čiji ćete biti
						jedini vlasnik.
					</span>
				</div>
				<div className="flex gap-1 items-center">
					<hr className="flex-1 border-t-2 border-gray-300" />
					<span className="text-gray-500">ili</span>
					<hr className="flex-1 border-t-2 border-gray-300" />
				</div>
				<div className="flex flex-col gap-2">
					<Button asChild={true}>
						<Link
							href="?type=invite"
							className="flex pointer-events-none opacity-50 items-center gap-2"
						>
							<MailPlus />
							Prijavi se za klub
							<BadgeSoon />
						</Link>
					</Button>
					<span className="text-gray-500">
						Vaš klub je već na ovom sajtu? Možete zatražiti pozivnicu preko ove
						opcije.
					</span>
				</div>
			</div>
		</>
	);
}
