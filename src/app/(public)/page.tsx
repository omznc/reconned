import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { EventsCarousel } from "@/app/(public)/_components/carousel";

const events = [
	{
		id: "1",
		title: "Operation Sandstorm",
		date: new Date(2024, 9, 15),
		location: "Desert Field",
		image: "https://vxlmjpixel.vercel.app/api/image?id=1",
		club: "Tvrđava",
	},
	{
		id: "2",
		title: "Urban Assault",
		date: new Date(2024, 9, 22),
		location: "City Arena",
		image: "https://vxlmjpixel.vercel.app/api/image?id=2",
		club: "Tvrđava",
	},
	{
		id: "3",
		title: "Forest Fury",
		date: new Date(2024, 10, 5),
		location: "Woodland Area",
		image: "https://vxlmjpixel.vercel.app/api/image?id=3",
		club: "Tvrđava",
	},
	{
		id: "4",
		title: "Night Ops Challenge",
		date: new Date(2024, 10, 12),
		location: "Night Vision Field",
		image: "https://vxlmjpixel.vercel.app/api/image?id=4",
		club: "Tvrđava",
	},
	{
		id: "5",
		title: "Capture the Flag Tournament",
		date: new Date(2024, 10, 19),
		location: "Multi-terrain Complex",
		image: "https://vxlmjpixel.vercel.app/api/image?id=5",
		club: "Tvrđava",
	},
	{
		id: "6",
		title: "Mountain Siege",
		date: new Date(2024, 10, 26),
		location: "Highland Base",
		image: "https://vxlmjpixel.vercel.app/api/image?id=6",
		club: "Tvrđava",
	},
	{
		id: "7",
		title: "Swamp Skirmish",
		date: new Date(2024, 11, 2),
		location: "Swamp Grounds",
		image: "https://vxlmjpixel.vercel.app/api/image?id=7",
		club: "Tvrđava",
	},
	{
		id: "8",
		title: "Beachfront Battle",
		date: new Date(2024, 11, 9),
		location: "Coastal Area",
		image: "https://vxlmjpixel.vercel.app/api/image?id=8",
		club: "Tvrđava",
	},
	{
		id: "9",
		title: "Snowfield Showdown",
		date: new Date(2024, 11, 16),
		location: "Snowy Plains",
		image: "https://vxlmjpixel.vercel.app/api/image?id=9",
		club: "Tvrđava",
	},
	{
		id: "10",
		title: "Canyon Clash",
		date: new Date(2024, 11, 23),
		location: "Canyon Arena",
		image: "https://vxlmjpixel.vercel.app/api/image?id=10",
		club: "Tvrđava",
	},
	{
		id: "11",
		title: "Desert Duel",
		date: new Date(2024, 11, 30),
		location: "Desert Outpost",
		image: "https://vxlmjpixel.vercel.app/api/image?id=11",
		club: "Tvrđava",
	},
	{
		id: "12",
		title: "Jungle Jamboree",
		date: new Date(2025, 0, 6),
		location: "Jungle Zone",
		image: "https://vxlmjpixel.vercel.app/api/image?id=12",
		club: "Tvrđava",
	},
	{
		id: "13",
		title: "Valley Vengeance",
		date: new Date(2025, 0, 13),
		location: "Valley Field",
		image: "https://vxlmjpixel.vercel.app/api/image?id=13",
		club: "Tvrđava",
	},
	{
		id: "14",
		title: "Riverside Rumble",
		date: new Date(2025, 0, 20),
		location: "Riverbank Arena",
		image: "https://vxlmjpixel.vercel.app/api/image?id=14",
		club: "Tvrđava",
	},
	{
		id: "15",
		title: "Urban Warfare",
		date: new Date(2025, 0, 27),
		location: "City Center",
		image: "https://vxlmjpixel.vercel.app/api/image?id=15",
		club: "Tvrđava",
	},
];

export default function Home() {
	return (
		<div className="flex flex-col size-full gap-8">
			<div className="flex flex-col gap-3">
				<Link
					href={"/events"}
					className="text-2xl group flex gap-1 items-center font-semibold"
				>
					Nadolazeći susreti
					<ArrowRight className="opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all translate-x-10" />
				</Link>
				{events.length > 0 ? (
					<EventsCarousel events={events} />
				) : (
					<span>
						Ne postoji nijedan susret u budućnosti. Da li ste klub? Ovo je
						savršeno vrijeme da organizirate susret!
					</span>
				)}
			</div>
		</div>
	);
}
