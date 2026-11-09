"use client";

import { Banknote, Check, CheckCheck, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import apiClient from "@/lib/api/api.client";
import { getApiErrorMessage } from "@/lib/api/api-error";
import type { ApiResponse, Event } from "@/lib/api/api-type-helpers";

type Registrations = ApiResponse<"/api/events/{id}/registrations", "get">["registrations"];

interface AttendanceTrackerProps {
	event: Event & {
		eventRegistration: Registrations;
	};
}

type AttendeeStatus = Registrations[number]["invitedUsers"][number]["status"];

/**
 * One person on one booking. The roster is a list of people rather than a list of bookings,
 * because a team can turn up without one of its members and the door needs to record that.
 */
interface RosterPerson {
	attendeeId: string;
	name: string;
	email: string | null;
	image: string | null;
	status: AttendeeStatus;
	attended: boolean | null;
	/** When they settled up, or null if they have not. Kept as the timestamp the backend stores. */
	paidAt: string | null;
	isLeader: boolean;
}

interface RosterTeam {
	registrationId: string;
	leaderName: string;
	people: RosterPerson[];
}

export function AttendanceTracker({ event }: AttendanceTrackerProps) {
	const [search, setSearch] = useState("");
	const [pending, setPending] = useState<string | null>(null);
	const [pendingPayment, setPendingPayment] = useState<string | null>(null);
	// Keyed by attendee id, so a correction shows instantly and rolls back on failure.
	const [overrides, setOverrides] = useState<Record<string, boolean | null>>({});
	const [paidOverrides, setPaidOverrides] = useState<Record<string, string | null>>({});
	const t = useExtracted();

	const teams: RosterTeam[] = event.eventRegistration.map((registration) => {
		const leader: RosterPerson[] = registration.createdBy
			? [
					{
						attendeeId: registration.createdBy.attendeeId,
						name: registration.createdBy.name,
						email: registration.createdBy.email,
						image: registration.createdBy.image,
						status: registration.createdBy.status,
						attended: registration.createdBy.attended,
						paidAt: registration.createdBy.paidAt,
						isLeader: true,
					},
				]
			: [];

		const members: RosterPerson[] = registration.invitedUsers.map((person) => ({
			attendeeId: person.attendeeId,
			name: person.name,
			email: person.email,
			image: person.image,
			status: person.status,
			attended: person.attended,
			paidAt: person.paidAt,
			isLeader: false,
		}));

		const guests: RosterPerson[] = registration.invitedUsersNotOnApp.map((person) => ({
			attendeeId: person.attendeeId,
			name: person.name,
			email: person.email,
			image: null,
			status: person.status,
			attended: person.attended,
			paidAt: person.paidAt,
			isLeader: false,
		}));

		return {
			registrationId: registration.id,
			leaderName: registration.createdBy?.name ?? t("Unknown"),
			people: [...leader, ...members, ...guests].map((person) => ({
				...person,
				attended: person.attendeeId in overrides ? (overrides[person.attendeeId] ?? null) : person.attended,
				paidAt: person.attendeeId in paidOverrides ? (paidOverrides[person.attendeeId] ?? null) : person.paidAt,
			})),
		};
	});

	const terms = search.toLowerCase().split(" ").filter(Boolean);

	const matches = (person: RosterPerson) => {
		if (terms.length === 0) {
			return true;
		}
		const haystack = `${person.name} ${person.email ?? ""}`.toLowerCase();
		return terms.every((term) => haystack.includes(term));
	};

	const visibleTeams = teams
		.map((team) => ({ ...team, people: team.people.filter(matches) }))
		.filter((team) => team.people.length > 0);

	const everyone = teams.flatMap((team) => team.people);
	const expected = everyone.filter((person) => person.status === "CONFIRMED");
	const present = expected.filter((person) => person.attended === true);
	const paid = expected.filter((person) => person.paidAt !== null);

	async function setAttendance(person: RosterPerson, attended: boolean | null) {
		const previous = person.attended;
		setPending(person.attendeeId);
		setOverrides((prev) => ({ ...prev, [person.attendeeId]: attended }));

		try {
			const { error } = await apiClient.PUT("/api/events/{id}/attendees/{attendeeId}/attendance", {
				params: { path: { id: event.id, attendeeId: person.attendeeId } },
				body: { attended },
			});

			if (error) {
				throw new Error(getApiErrorMessage(error, t("An error occurred while saving presence")));
			}
		} catch (error) {
			setOverrides((prev) => ({ ...prev, [person.attendeeId]: previous }));
			toast.error(getApiErrorMessage(error, t("An error occurred while saving presence")));
		} finally {
			setPending(null);
		}
	}

	/**
	 * Payment is tracked per person rather than per booking, because a captain can settle up for
	 * some of their team and not others. Unmarking clears the timestamp rather than storing a
	 * "false" — money that has not arrived is money that has not arrived.
	 */
	async function setPaid(person: RosterPerson, paid: boolean) {
		const previous = person.paidAt;
		setPendingPayment(person.attendeeId);
		setPaidOverrides((prev) => ({ ...prev, [person.attendeeId]: paid ? new Date().toISOString() : null }));

		try {
			const { data, error } = await apiClient.PUT("/api/events/{id}/attendees/{attendeeId}/payment", {
				params: { path: { id: event.id, attendeeId: person.attendeeId } },
				body: { paid },
			});

			if (error || !data) {
				throw new Error(getApiErrorMessage(error, t("An error occurred while saving the payment")));
			}

			// The server's timestamp is the one that counts; the optimistic one was only a placeholder.
			setPaidOverrides((prev) => ({ ...prev, [person.attendeeId]: data.attendee.paidAt }));
		} catch (error) {
			setPaidOverrides((prev) => ({ ...prev, [person.attendeeId]: previous }));
			toast.error(getApiErrorMessage(error, t("An error occurred while saving the payment")));
		} finally {
			setPendingPayment(null);
		}
	}

	async function markWholeTeam(team: RosterTeam) {
		const confirmed = team.people.filter((person) => person.status === "CONFIRMED");
		setPending(team.registrationId);
		setOverrides((prev) => {
			const next = { ...prev };
			for (const person of confirmed) {
				next[person.attendeeId] = true;
			}
			return next;
		});

		try {
			const { error } = await apiClient.PUT("/api/events/{id}/registrations/{registrationId}/attendance", {
				params: { path: { id: event.id, registrationId: team.registrationId } },
				body: { attended: true },
			});

			if (error) {
				throw new Error(getApiErrorMessage(error, t("An error occurred while saving presence")));
			}
		} catch (error) {
			setOverrides((prev) => {
				const next = { ...prev };
				for (const person of confirmed) {
					next[person.attendeeId] = person.attended;
				}
				return next;
			});
			toast.error(getApiErrorMessage(error, t("An error occurred while saving presence")));
		} finally {
			setPending(null);
		}
	}

	function statusLabel(status: AttendeeStatus) {
		switch (status) {
			case "PENDING":
				return t("Awaiting response");
			case "DECLINED":
				return t("Declined");
			case "CANCELLED":
				return t("Cancelled");
			case "WAITLISTED":
				return t("On the waiting list");
			default:
				return null;
		}
	}

	function PersonRow({ person }: { person: RosterPerson }) {
		const label = statusLabel(person.status);

		return (
			<div className="flex items-center justify-between gap-3 py-2">
				<div className="flex items-center gap-3 min-w-0">
					<Avatar className="h-8 w-8">
						<AvatarImage src={person.image || ""} />
						<AvatarFallback name={person.name} />
					</Avatar>
					<div className="flex flex-col min-w-0">
						<span className="text-sm truncate">{person.name}</span>
						{label && <span className="text-xs text-muted-foreground">{label}</span>}
					</div>
					{person.isLeader && <Badge variant="outline">{t("Booked")}</Badge>}
				</div>
				{/* Only somebody who holds a place can be marked present. Anyone still deciding,
				    or already out, has nothing to answer for. */}
				{person.status === "CONFIRMED" && (
					<div className="flex items-center gap-2">
						<Button
							variant={person.paidAt ? "secondary" : "outline"}
							size="sm"
							onClick={() => setPaid(person, !person.paidAt)}
							disabled={pendingPayment === person.attendeeId}
							title={person.paidAt ? t("Paid") : t("Not paid yet")}
						>
							<Banknote className="h-4 w-4" />
							{person.paidAt ? t("Paid") : t("Unpaid")}
						</Button>
						<Button
							variant={person.attended === true ? "destructive" : "default"}
							size="sm"
							onClick={() => setAttendance(person, person.attended !== true)}
							disabled={pending === person.attendeeId}
						>
							{person.attended === true ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
						</Button>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="space-y-4 w-full max-w-3xl">
			<Input
				placeholder={t("Search participants...")}
				value={search}
				onChange={(e) => setSearch(e.target.value)}
			/>
			<p className="text-sm text-muted-foreground">
				{t("{present} of {expected} present", {
					present: String(present.length),
					expected: String(expected.length),
				})}
				{" · "}
				{t("{paid} of {expected} paid", {
					paid: String(paid.length),
					expected: String(expected.length),
				})}
			</p>
			<div className="space-y-4">
				{visibleTeams.map((team) => (
					<Card key={team.registrationId}>
						<CardContent className="p-4">
							<div className="flex items-center justify-between gap-3 pb-2 border-b">
								<span className="font-semibold truncate">{team.leaderName}</span>
								{team.people.filter((person) => person.status === "CONFIRMED").length > 1 && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => markWholeTeam(team)}
										disabled={pending === team.registrationId}
									>
										<CheckCheck className="h-4 w-4 mr-1" />
										{t("All present")}
									</Button>
								)}
							</div>
							<div className="divide-y">
								{team.people.map((person) => (
									<PersonRow key={person.attendeeId} person={person} />
								))}
							</div>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
