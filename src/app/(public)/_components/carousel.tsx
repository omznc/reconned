"use client";

import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { format } from "date-fns";
import Link from "next/link";
import Autoplay from "embla-carousel-autoplay";
import { useIsAuthenticated } from "@/lib/auth-client";

interface CarouselProps {
	events: {
		id: string;
		title: string;
		date: Date;
		location: string;
		club: string;
	}[];
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
						<img
							src={"https://picsum.photos/200/300"}
							alt={event.title}
							className="size-full border border-b-0 object-cover transition-all"
						/>
						<div className="flex flex-col gap-1 pb-16 md:pb-2 md:group-hover:pb-16 transition-all p-2 border border-t-none ">
							<h3 className="text-xl font-semibold">{event.title}</h3>
							<p className="text-sm">
								{format(event.date, "do MMMM, yyyy")}, {event.location}
							</p>
							<p className="text-sm">{event.club}</p>
							<Button
								asChild={true}
								className="absolute cursor-pointer md:translate-y-16 md:group-hover:translate-y-0 transition-all bottom-2 left-6 right-2"
							>
								{user ? (
									<Link href={`/events/${event.id}?register=true`}>Prijavi se na susret</Link>
								) : (
									<Link href="/login">Uloguj se</Link>
								)}
							</Button>
						</div>
					</CarouselItem>
				))}
			</CarouselContent>
		</Carousel>
	);
}
