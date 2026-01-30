"use client";

import { Check, Eye, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse, Event, EventRegistration } from "@/lib/api/api-type-helpers";

interface AttendanceTrackerProps {
	event: Event & {
		eventRegistration: ApiResponse<"/api/events/{id}/registrations", "get">["registrations"];
	};
}

export function AttendanceTracker({ event }: AttendanceTrackerProps) {
	const [search, setSearch] = useState("");
	const [isLoading, setIsLoading] = useState<string | null>(null);
	const [optimisticRegistrations, setOptimisticRegistrations] = useState<Record<string, EventRegistration>>({});
	const t = useExtracted();

	const registrations = event.eventRegistration.map((reg) => ({
		...reg,
		...(optimisticRegistrations[reg.id] || {}),
	}));

	const filteredRegistrations = registrations.filter((reg) => {
		const searchTerms = search.toLowerCase().split(" ");
		const searchableText = [
			reg.createdBy?.name,
			reg.createdBy?.email,
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

	async function handleToggleAttendance(registration: EventRegistration) {
		try {
			setIsLoading(registration.id);
			setOptimisticRegistrations((prev) => ({
				...prev,
				[registration.id]: {
					...registration,
					attended: !registration.attended,
				},
			}));

			const { error } = await apiClient.PUT("/api/events/{id}/registrations/{registrationId}/attendance", {
				params: {
					path: {
						id: event.id,
						registrationId: registration.id,
					},
				},
				body: {
					attended: !registration.attended,
				},
			});

			if (error) {
				throw new Error(error.error || t("An error occurred while saving presence"));
			}
		} catch (error) {
			setOptimisticRegistrations((prev) => ({
				...prev,
				[registration.id]: registration,
			}));
			const message = error instanceof Error ? error.message : t("An error occurred while saving presence");
			toast.error(message);
		} finally {
			setIsLoading(null);
		}
	}

	function RegistrationCard({ registration }: { registration: EventRegistration }) {
		return (
			<Card>
				<CardContent className="p-4 flex justify-between items-center">
					<div className="flex gap-3 items-center">
						<Avatar>
							<AvatarImage src={registration.createdBy?.image || ""} />
							{!registration.createdBy?.image && <AvatarFallback name={registration.createdBy?.name} />}
						</Avatar>
						<div className="flex flex-col gap-1">
							<p className="font-semibold">{registration.createdBy?.name}</p>
							{(registration.invitedUsers.length > 0 || registration.invitedUsersNotOnApp.length > 0) && (
								<HoverCard openDelay={100}>
									<HoverCardTrigger asChild>
										<p className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
											{t("+ {count} others", {
												count: String(
													registration.invitedUsers.length +
														registration.invitedUsersNotOnApp.length,
												),
											})}
											<Eye className="h-4 w-4 inline" />
										</p>
									</HoverCardTrigger>
									<HoverCardContent className="w-64 p-2">
										<div className="space-y-2">
											{registration.invitedUsers.map((user) => (
												<div key={user.id} className="flex items-center gap-2">
													<Avatar className="h-6 w-6">
														<AvatarImage src={user.image || ""} />
														<AvatarFallback name={user.name} className="text-xs" />
													</Avatar>
													<span className="text-sm">{user.name}</span>
												</div>
											))}
											{registration.invitedUsersNotOnApp.map((user) => (
												<div
													key={`${user.email}-${user.name}-avatar`}
													className="flex items-center gap-2"
												>
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
						{registration.attended ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4 w-full max-w-3xl">
			<Input
				placeholder={t("Search participants...")}
				value={search}
				onChange={(e) => setSearch(e.target.value)}
			/>
			<div className="grid md:grid-cols-2 gap-4">
				<div className="space-y-4 w-fit">
					<h2 className="font-semibold">
						{t("Registered")} ({notAttending.length})
					</h2>
					{notAttending.map((registration) => (
						<RegistrationCard key={registration.id} registration={registration} />
					))}
				</div>
				<div className="space-y-4 w-fit">
					<h2 className="font-semibold">
						{t("Present")} ({attendees.length})
					</h2>
					{attendees.map((registration) => (
						<RegistrationCard key={registration.id} registration={registration} />
					))}
				</div>
			</div>
		</div>
	);
}
