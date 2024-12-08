"use client";

import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Eye, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useState } from "react";
import { toast } from "sonner";
import type { Event, EventRegistration, User } from "@prisma/client";
import { toggleAttendance } from "@/app/dashboard/(club)/[clubId]/events/[id]/attendance/_components/attendance.action";

type ExtendedEventRegistration = EventRegistration & {
	invitedUsers: User[];
	createdBy: User;
	invitedUsersNotOnApp: {
		name: string;
		email: string;
	}[];
};

interface AttendanceTrackerProps {
	event: Event & {
		eventRegistration: ExtendedEventRegistration[];
	};
}

export function AttendanceTracker({ event }: AttendanceTrackerProps) {
	const [search, setSearch] = useState("");
	const [isLoading, setIsLoading] = useState<string | null>(null);
	const [optimisticRegistrations, setOptimisticRegistrations] = useState<
		Record<string, ExtendedEventRegistration>
	>({});

	const registrations = event.eventRegistration.map((reg) => ({
		...reg,
		...(optimisticRegistrations[reg.id] || {}),
	}));

	const filteredRegistrations = registrations.filter((reg) => {
		const searchTerms = search.toLowerCase().split(" ");
		const searchableText = [
			reg.createdBy.name,
			reg.createdBy.email,
			...reg.invitedUsers.map((u) => u.name),
			...reg.invitedUsers.map((u) => u.email),
			...reg.invitedUsersNotOnApp.map((u) => u.name),
			...reg.invitedUsersNotOnApp.map((u) => u.email),
		]
			.join(" ")
			.toLowerCase();

		return searchTerms.every((term) => searchableText.includes(term));
	});

	const attendees = filteredRegistrations.filter((r) => r.attended);
	const notAttending = filteredRegistrations.filter((r) => !r.attended);

	async function handleToggleAttendance(
		registration: ExtendedEventRegistration,
	) {
		try {
			setIsLoading(registration.id);
			// Store complete registration data in optimistic state
			setOptimisticRegistrations((prev) => ({
				...prev,
				[registration.id]: {
					...registration,
					attended: !registration.attended,
				},
			}));

			await toggleAttendance({
				registrationId: registration.id,
				eventId: event.id,
				attended: !registration.attended,
				clubId: event.clubId,
			});
		} catch (_error) {
			// Revert to original registration data on error
			setOptimisticRegistrations((prev) => ({
				...prev,
				[registration.id]: registration,
			}));
			toast.error("Došlo je do greške");
		} finally {
			setIsLoading(null);
		}
	}

	function RegistrationCard({
		registration,
	}: { registration: ExtendedEventRegistration }) {
		return (
			<Card>
				<CardContent className="p-4 flex justify-between items-center">
					<div className="flex gap-3 items-center">
						<Avatar>
							<AvatarImage src={registration.createdBy.image ?? ""} />
							{!registration.createdBy.image && (
								<AvatarFallback>
									{registration.createdBy.name?.slice(0, 2).toUpperCase()}
								</AvatarFallback>
							)}
						</Avatar>
						<div className="flex flex-col gap-1">
							<p className="font-semibold">{registration.createdBy.name}</p>
							{(registration.invitedUsers.length > 0 ||
								registration.invitedUsersNotOnApp.length > 0) && (
								<HoverCard openDelay={100}>
									<HoverCardTrigger asChild>
										<p className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
											+{" "}
											{registration.invitedUsers.length +
												registration.invitedUsersNotOnApp.length}{" "}
											drugih <Eye className="h-4 w-4 inline" />
										</p>
									</HoverCardTrigger>
									<HoverCardContent className="w-64 p-2">
										<div className="space-y-2">
											{registration.invitedUsers.map((user) => (
												<div key={user.id} className="flex items-center gap-2">
													<Avatar className="h-6 w-6">
														<AvatarImage src={user.image ?? ""} />
														<AvatarFallback className="text-xs">
															{user.name?.slice(0, 2).toUpperCase()}
														</AvatarFallback>
													</Avatar>
													<span className="text-sm">{user.name}</span>
												</div>
											))}
											{registration.invitedUsersNotOnApp.map((user, idx) => (
												<div key={idx} className="flex items-center gap-2">
													<Avatar className="h-6 w-6">
														<AvatarFallback className="text-xs">
															{user.name?.slice(0, 2).toUpperCase()}
														</AvatarFallback>
													</Avatar>
													<span className="text-sm">{user.name}</span>
												</div>
											))}
										</div>
									</HoverCardContent>
								</HoverCard>
							)}
						</div>
					</div>
					<Button
						variant={registration.attended ? "destructive" : "default"}
						size="sm"
						className="ml-4"
						onClick={() => handleToggleAttendance(registration)}
						disabled={isLoading === registration.id}
					>
						{registration.attended ? (
							<X className="h-4 w-4" />
						) : (
							<Check className="h-4 w-4" />
						)}
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4 w-full max-w-3xl">
			<Input
				placeholder="Pretraži učesnike..."
				value={search}
				onChange={(e) => setSearch(e.target.value)}
			/>
			<div className="grid md:grid-cols-2 gap-4">
				<div className="space-y-4 w-fit">
					<h2 className="font-semibold">
						Registrovani ({notAttending.length})
					</h2>
					{notAttending.map((registration) => (
						<RegistrationCard
							key={registration.id}
							registration={registration}
						/>
					))}
				</div>
				<div className="space-y-4 w-fit">
					<h2 className="font-semibold">Prisutni ({attendees.length})</h2>
					{attendees.map((registration) => (
						<RegistrationCard
							key={registration.id}
							registration={registration}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
