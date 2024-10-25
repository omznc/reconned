"use client";

import { Button } from "@/components/ui/button";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
} from "@/components/ui/carousel";
import { format } from "date-fns";
import Link from "next/link";
import Autoplay from "embla-carousel-autoplay";
import { useIsAuthenticated } from "@/lib/auth-client";
import type { Event } from "@prisma/client";
import Image from "next/image";

interface CarouselProps {
	events: (Event & { club: { name: string } })[];
}

export function EventsCarousel(props: CarouselProps) {
	const { user } = useIsAuthenticated();
	return (
		<Carousel
			opts={{
				align: "start",
				loop: true,
			}}
			plugins={[
				Autoplay({
					delay: 2000,
					stopOnMouseEnter: true,
				}),
			]}
			className="border-x border-border/50"
		>
			<CarouselContent className="-ml-4 ">
				{props.events.map((event) => (
					<CarouselItem
						key={event.id}
						className="pl-4 bg-white group select-none flex h-[300px] overflow-hidden relative md:basis-1/2 lg:basis-1/3 flex-col "
					>
						<Image
							suppressHydrationWarning={true}
							src={`${event.coverImage}?v=${event.updatedAt}`}
							alt={event.name}
							width={300}
							height={350}
							className="size-full border border-b-0 object-cover transition-all"
						/>
						<div className="flex flex-col gap-1  md:pb-2 md:group-hover:pb-16 transition-all p-2 border border-t-none">
							<h3 className="text-xl font-semibold">{event.name}</h3>
							<p className="text-sm">
								{format(event.dateStart, "do MMMM, yyyy")}, {event.location}
							</p>
							<p className="text-sm">{event.club.name}</p>
							<div className="flex gap-2 md:translate-y-16 w-full md:group-hover:translate-y-14">
								<Button
									asChild={true}
									variant={"outline"}
									className="cursor-pointer w-1/2 transition-all"
								>
									{user ? (
										<Link href={`/events/${event.id}?register=true`}>
											Prijavi se na susret
										</Link>
									) : (
										<Link href="/login">Uloguj se</Link>
									)}
								</Button>
								<Button asChild={true} className="w-1/2 cursor-pointer">
									<Link href={`/events/${event.id}`}>Detalji</Link>
								</Button>
							</div>
						</div>
					</CarouselItem>
				))}
			</CarouselContent>
		</Carousel>
	);
}
