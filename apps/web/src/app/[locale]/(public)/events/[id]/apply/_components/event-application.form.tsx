"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "better-auth";
import DOMPurify from "isomorphic-dompurify";
import { AlertCircle, ChevronsUpDown, CirclePlus, Mail, Plus, UserIcon, Users, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import * as z from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Club, ClubRule, Event } from "@/lib/api/api-type-helpers";
import "@/components/editor/editor.css";

import debounce from "lodash/debounce";
import posthog from "posthog-js";
import { toast } from "sonner";
import { Loader } from "@/components/loader";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { cn, isValidEmail } from "@/lib/utils";

interface EventApplicationProps {
	existingApplication: ApiResponse<"/api/events/{id}/apply-data", "get">["existingRegistration"];
	event: Event & { rules: ClubRule[] };
	user: User;
	currentUserClubs: Omit<Club, "_count">[];
}

type SearchUser = ApiResponse<"/api/users", "get">["users"][number];

export function EventApplicationForm({ existingApplication, event, user, currentUserClubs }: EventApplicationProps) {
	const [step, setStep] = useState(1);
	const router = useRouter();
	const t = useExtracted();
	const confirm = useConfirm();

	const eventApplicationSchema = z.object({
		eventId: z.string().min(1, { message: t("Event ID is required") }),
		type: z.enum(["solo", "team"], {
			message: t("Application type is required"),
		}),
		invitedUsers: z.array(
			z.object({
				id: z.string().optional(),
				email: z.string().email().optional(),
				name: z.string().min(1, t("Name is required")),
				callsign: z.string().nullable().optional(),
				image: z.string().nullable().optional(),
			}),
		),
		invitedUsersNotOnApp: z.array(
			z.object({
				id: z.string().optional(),
				email: z.string().email(t("Invalid email")),
				name: z.string().min(1, t("Name is required")),
			}),
		),
		paymentMethod: z.enum(["cash", "bank"], {
			message: t("Payment method is required"),
		}),
		rulesAccepted: z.boolean().refine((val) => val === true, {
			message: t("You must accept the event rules"),
		}),
	});

	type EventApplicationSchemaType = z.infer<typeof eventApplicationSchema>;

	// Initialize form with existing application data if it exists
	const form = useForm<EventApplicationSchemaType>({
		resolver: zodResolver(eventApplicationSchema),
		defaultValues: {
			eventId: event.id,
			type: existingApplication?.type as EventApplicationSchemaType["type"],
			invitedUsers: existingApplication
				? [
						// Current user is always first
						{
							id: user.id,
							name: user.name,
							email: user.email,
							image: user.image,
							// @ts-expect-error Callsign exists on user, but heyyy.
							callsign: user.callsign || null,
						},
						...existingApplication.invitedUsers
							.filter((u): u is typeof u & { email: string } => u.id !== user.id && u.email !== null)
							.map((u) => ({
								id: u.id,
								name: u.name,
								email: u.email,
								callsign: u.callsign,
								image: u.image,
							})),
					]
				: [
						{
							id: user.id,
							name: user.name,
							email: user.email,
							image: user.image,
							// @ts-expect-error Callsign exists on user, but heyyy.

							callsign: user.callsign || null,
						},
					],
			invitedUsersNotOnApp: existingApplication?.invitedUsersNotOnApp || [],
			rulesAccepted: false,
			paymentMethod:
				(existingApplication?.paymentMethod as EventApplicationSchemaType["paymentMethod"]) || "cash",
		},
	});

	// Initialize current user as first team member when switching to team mode
	const handleTypeChange = (type: "solo" | "team") => {
		form.setValue("type", type);
		if (type === "solo") {
			form.setValue("invitedUsers", []);
			form.setValue("invitedUsersNotOnApp", []);
		}
		setStep(2);
	};

	const { fields: invitedUserFields, remove: removeInvitedUsers } = useFieldArray({
		control: form.control,
		name: "invitedUsers",
		rules: {
			required: true,
			minLength: form.watch("type") === "team" ? 2 : 1,
		},
	});

	const { fields: invitedUserNotOnAppFields, remove: removeInvitedUsersNotOnApp } = useFieldArray({
		control: form.control,
		name: "invitedUsersNotOnApp",
	});

	const onSubmit = async (data: EventApplicationSchemaType) => {
		toast.promise(
			(async () => {
				const { error } = await apiClient.POST("/api/events/{id}/registrations", {
					params: {
						path: {
							id: event.id,
						},
					},
					body: {
						type: data.type,
						paymentMethod: data.paymentMethod,
						invitedUsers: data.invitedUsers.map((user) => ({
							id: user.id,
						})),
						invitedUsersNotOnApp: data.invitedUsersNotOnApp.map((user) => ({
							name: user.name,
							email: user.email,
						})),
					},
				});

				if (error) {
					throw new Error(error.error || t("An error occurred while applying"));
				}
			})(),
			{
				loading: t("Submitting application..."),
				success: () => {
					// Track event application
					posthog.capture("event_application_submitted", {
						user_id: user.id,
						event_id: event.id,
						club_id: event.clubId,
						application_type: data.type,
						payment_method: data.paymentMethod,
						team_members_count: data.invitedUsers.length + data.invitedUsersNotOnApp.length,
						invited_users_count: data.invitedUsers.length,
						external_invites_count: data.invitedUsersNotOnApp.length,
					});

					router.push(`/events/${event.id}`);
					return t("Successfully applied to event!");
				},
				error: (e) => e?.message || t("An error occurred while applying"),
			},
		);
	};

	// Update validation message
	const handleNextStep = () => {
		if (step === 2 && form.watch("type") === "team") {
			const totalMembers = invitedUserFields.length + invitedUserNotOnAppFields.length;
			if (totalMembers < 2) {
				form.setError("invitedUsers", {
					type: "manual",
					message: t("Team must have at least one member besides you"),
				});
				return;
			}
		}
		if (step === 3 && !form.watch("rulesAccepted")) {
			form.setError("rulesAccepted", {
				type: "manual",
				message: t("You must accept the event rules"),
			});
			return;
		}

		setStep(step + 1);
	};

	const [open, setOpen] = useState(false);
	const [searchValue, setSearchValue] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const [searchResults, setSearchResults] = useState<SearchUser[]>([]);

	const searchUsers = useCallback(async (query: string) => {
		setIsSearching(true);
		try {
			const { data, error } = await apiClient.GET("/api/users", {
				params: {
					query: {
						search: query,
						page: 1,
						perPage: 25,
					},
				},
			});
			if (error || !data) {
				throw new Error("Search failed");
			}
			setSearchResults(data.users);
		} catch (_) {
			setSearchResults([]);
		} finally {
			setIsSearching(false);
		}
	}, []);

	const debouncedSearch = useMemo(
		() =>
			debounce((value: string) => {
				if (value.length >= 2) {
					searchUsers(value);
				} else {
					setSearchResults([]);
				}
			}, 300),
		[searchUsers],
	);

	const handleSearch = useCallback(
		(value: string) => {
			setSearchValue(value);
			debouncedSearch(value);
		},
		[debouncedSearch],
	);

	const [showAddMember, setShowAddMember] = useState(false);
	const [tempMember, setTempMember] = useState({ name: "", email: "" });

	const addCustomMember = () => {
		if (tempMember.name && tempMember.email) {
			form.setValue("invitedUsersNotOnApp", [
				...form.getValues("invitedUsersNotOnApp"),
				{
					name: tempMember.name,
					email: tempMember.email,
				},
			]);
			setTempMember({ name: "", email: "" });
			setShowAddMember(false);
		}
	};

	const handleAddExistingUser = (user: SearchUser) => {
		form.setValue("invitedUsers", [
			...form.getValues("invitedUsers"),
			{
				id: user.id,
				name: user.name,
				email: user.email ?? undefined,
				image: user.image,
				callsign: user.callsign,
			},
		]);
		setSearchValue("");
		setOpen(false);
	};

	// Add delete handler
	const handleDelete = async () => {
		const confirmed = await confirm({
			title: t("Are you sure?"),
			body: t(
				"Are you sure you want to delete your application? This will also delete all invitations you sent.",
			),
			cancelButton: t("Cancel"),
			actionButton: t("Confirm"),
			actionButtonVariant: "destructive",
		});

		if (confirmed) {
			toast.promise(
				(async () => {
					const { error } = await apiClient.DELETE("/api/events/{id}/registrations", {
						params: {
							path: {
								id: event.id,
							},
						},
					});

					if (error) {
						throw new Error(error.error || t("An error occurred while deleting application"));
					}
				})(),
				{
					loading: t("Deleting application..."),
					success: () => {
						router.refresh();
						router.push(`/events/${event.id}`);
						return t("Successfully deleted application!");
					},
					error: t("An error occurred while deleting application"),
				},
			);
		}
	};

	// Modify the type selection step to show warnings and current selection
	const renderTypeSelection = () => (
		<div className="space-y-4">
			{/* Mobile View */}
			<div className="flex fade-in-up flex-col gap-4 w-full md:hidden">
				<div className="flex flex-col gap-2">
					<Button
						type="button"
						className="flex items-center gap-2"
						onClick={() => handleTypeChange("solo")}
						disabled={!event.allowFreelancers && currentUserClubs.length === 0}
					>
						<CirclePlus />
						{t("Apply solo")}
					</Button>
					<span className="text-gray-500 text-sm">
						{!event.allowFreelancers && currentUserClubs.length === 0
							? t(
									"You cannot apply solo because you are not a member of any club and this event does not allow freelancer applications.",
								)
							: t("Choose this option if you're coming alone to the event")}
					</span>
					{existingApplication !== null && (
						<>
							{form.watch("type") === "solo" && (
								<p className="text-sm text-primary">{t("Currently selected")}</p>
							)}
							{form.watch("type") === "team" && (
								<p className="text-sm text-destructive">
									{t(
										"Switching to solo application will cancel all current team member invitations.",
									)}
								</p>
							)}
						</>
					)}
				</div>

				<div className="flex gap-1 items-center">
					<hr className="flex-1 border-t-2 border-gray-300" />
					<span className="text-gray-500">{t("or")}</span>
					<hr className="flex-1 border-t-2 border-gray-300" />
				</div>

				<div className="flex flex-col gap-2">
					<Button type="button" className="flex items-center gap-2" onClick={() => handleTypeChange("team")}>
						<Users />
						{t("Apply team")}
					</Button>
					<span className="text-gray-500 text-sm">
						{t("Choose this option if you're coming with multiple players")}
					</span>
					{existingApplication && form.watch("type") === "team" && (
						<p className="text-sm text-primary">{t("Currently selected")}</p>
					)}
				</div>
			</div>

			{/* Desktop View */}
			<div className="hidden fade-in-up md:grid grid-cols-2 gap-8 h-[400px]">
				<div className="space-y-2 h-fit">
					<button
						type="button"
						onClick={() => handleTypeChange("solo")}
						disabled={!event.allowFreelancers && currentUserClubs.length === 0}
						className="group h-[350px] disabled:cursor-not-allowed border relative flex flex-col items-center justify-center rounded-lg p-8 transition-all w-full"
					>
						{!event.allowFreelancers && currentUserClubs.length === 0 && (
							<div className="absolute backdrop-blur-[2px] p-4 inset-0 bg-black/30 dark:bg-black/80 rounded-lg flex items-center justify-center">
								<p className="text-sm text-center">
									{t(
										"You cannot apply solo because you are not a member of any club and this event does not allow freelancer applications.",
									)}
								</p>
							</div>
						)}
						<div className="size-32 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
							<CirclePlus className="size-16 text-muted-foreground group-hover:text-primary transition-colors" />
						</div>
						<div className="mt-8 text-center">
							<h3 className="text-2xl font-semibold mb-2">{t("Solo application")}</h3>
							<p className="text-muted-foreground">
								{t("Choose this option if you're coming alone to the event")}
							</p>
						</div>
						<div className="absolute inset-0 border-2 border-primary scale-105 opacity-0 rounded-lg group-hover:opacity-100 transition-all" />
					</button>
					{existingApplication !== null && (
						<>
							{form.watch("type") === "solo" && <p className="text-sm text-primary">Trenutno odabrano</p>}
							{form.watch("type") === "team" && (
								<p className="text-sm text-destructive">
									{t(
										"Switching to solo application will cancel all current team member invitations.",
									)}
								</p>
							)}
						</>
					)}
				</div>

				<div className="space-y-2 h-fit">
					<button
						type="button"
						onClick={() => handleTypeChange("team")}
						className="group h-[350px] border relative flex flex-col items-center justify-center rounded-lg p-8 transition-all w-full"
					>
						<div className="size-32 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
							<Users className="size-16 text-muted-foreground group-hover:text-primary transition-colors" />
						</div>
						<div className="mt-8 text-center">
							<h3 className="text-2xl font-semibold mb-2">{t("Team application")}</h3>
							<p className="text-muted-foreground">
								{t("Choose this option if you're coming with multiple players")}
							</p>
						</div>
						<div className="absolute inset-0 border-2 border-primary scale-105 opacity-0 rounded-lg group-hover:opacity-100 transition-all" />
					</button>
					{form.watch("type") === "team" && <p className="text-sm text-primary">Trenutno odabrano</p>}
				</div>
			</div>
		</div>
	);

	// Add delete button to navigation
	const renderNavigation = () => (
		<div className="flex gap-2 justify-between">
			{existingApplication && (
				<Button type="button" variant="destructive" onClick={handleDelete}>
					{t("Delete application")}
				</Button>
			)}

			<div className="flex gap-2">
				{step > 1 && (
					<Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
						{t("Back")}
					</Button>
				)}
				{step < 4 && (
					<Button type="button" onClick={() => handleNextStep()}>
						{t("Next")}
					</Button>
				)}

				{step === 4 && (
					<Button type="submit">{existingApplication ? t("Save changes") : t("Submit application")}</Button>
				)}
			</div>
		</div>
	);

	const renderInvitedUsers = () => (
		<div className="space-y-2">
			<h4 className="text-sm font-medium">{t("Members with account")}</h4>
			<span className="text-sm text-muted-foreground">
				{t(
					"These people have an account on the app, so the event will appear on their dashboard. There they can decline or see more information about it.",
				)}
			</span>
			{invitedUserFields.map((field, index) => (
				<div key={field.id} className="flex bg-sidebar items-center justify-between p-2 border rounded-md">
					<div className="flex items-center gap-2">
						<Avatar className="h-8 w-8">
							{field.image && <AvatarImage src={field.image} />}
							<AvatarFallback>{field.name.charAt(0).toUpperCase()}</AvatarFallback>
						</Avatar>
						<div className="flex flex-col">
							<span className="font-medium">
								{field.name}
								{field.callsign && <span className="text-muted-foreground"> ({field.callsign})</span>}
							</span>
							<span className="text-sm text-muted-foreground">{field.email}</span>
						</div>
					</div>
					{index > 0 && ( // Don't allow removing the creator
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => removeInvitedUsers(index)}
							className="text-destructive hover:text-destructive"
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>
			))}
		</div>
	);

	const renderInvitedUsersNotOnApp = () => (
		<div className="space-y-2">
			<h4 className="text-sm font-medium">{t("Invited members (without account)")}</h4>
			<span className="text-sm text-muted-foreground">
				{t(
					"Members who don't have an account on the app who will receive an email invitation. It's not mandatory to use it.",
				)}
			</span>
			{invitedUserNotOnAppFields.map((field, index) => (
				<div key={field.id} className="flex bg-sidebar items-center justify-between p-2 border rounded-md">
					<div className="flex items-center gap-2">
						<Avatar className="h-8 w-8">
							<AvatarFallback>
								<UserIcon className="h-4 w-4" />
							</AvatarFallback>
						</Avatar>
						<div className="flex flex-col">
							<span className="font-medium">{field.name}</span>
							<span className="text-sm text-muted-foreground">{field.email}</span>
						</div>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => removeInvitedUsersNotOnApp(index)}
						className="text-destructive hover:text-destructive"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			))}
		</div>
	);

	// Replace the existing team members section with this
	const renderTeamSection = () => (
		<div className="space-y-4">
			<h3 className="font-medium">{t("Team members")}</h3>
			<div className="flex gap-2">
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Button
							variant="outline"
							role="combobox"
							aria-expanded={open}
							className="w-full justify-between"
						>
							{searchValue || t("Search players...")}
							<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="p-0 w-[var(--radix-popover-trigger-width)]">
						<Command shouldFilter={false}>
							<CommandInput
								placeholder={t("Search by name, email or callsign...")}
								value={searchValue}
								onValueChange={handleSearch}
							/>
							<CommandList>
								{isSearching && (
									<CommandEmpty className="flex items-center h-32 justify-center">
										<Loader size={16} />
									</CommandEmpty>
								)}
								{!isSearching && searchValue.length < 2 && (
									<CommandEmpty>{t("Enter at least 2 characters...")}</CommandEmpty>
								)}
								{!isSearching && searchValue.length >= 2 && searchResults.length === 0 && (
									<CommandEmpty>
										<div className="p-4 text-sm space-y-4">
											<p>{t('No results for "{query}"', { query: searchValue })}</p>
											<Button
												type="button"
												variant="outline"
												className="w-full"
												onClick={() => {
													setTempMember({
														name: searchValue,
														email: "",
													});
													setShowAddMember(true);
													setOpen(false);
													setSearchValue("");
												}}
											>
												<Plus className="mr-2 h-4 w-4" />
												{t("Add new member")}
											</Button>
										</div>
									</CommandEmpty>
								)}
								<CommandGroup>
									{searchResults.map((user) => {
										const isAlreadyAdded = invitedUserFields.some((field) => field.id === user.id);
										return (
											<CommandItem
												key={user.id}
												value={user.id}
												onSelect={() => {
													if (!isAlreadyAdded) {
														handleAddExistingUser(user);
													}
												}}
												disabled={isAlreadyAdded}
												className={cn(
													"flex items-center gap-2 p-2",
													isAlreadyAdded && "opacity-50 cursor-not-allowed",
												)}
											>
												<Avatar className="h-8 w-8">
													{user.image && <AvatarImage src={user.image} />}
													<AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
												</Avatar>
												<div className="flex flex-col">
													<span className="font-medium">
														{user.name}
														{user.callsign && (
															<span className="text-muted-foreground">
																{" "}
																({user.callsign})
															</span>
														)}
														{isAlreadyAdded && (
															<span className="text-muted-foreground text-xs ml-2">
																- {t("Already added to team")}
															</span>
														)}
													</span>
													<span className="text-sm text-muted-foreground">{user.email}</span>
													{user.clubMembership && user.clubMembership.length > 0 && (
														<span className="text-xs text-muted-foreground">
															Član:{" "}
															{user.clubMembership
																.map((m) => m.club?.name ?? "")
																.join(", ")}
														</span>
													)}
												</div>
											</CommandItem>
										);
									})}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			</div>

			{/* Rest of team section */}
			{invitedUserFields.length > 0 && renderInvitedUsers()}
			{invitedUserNotOnAppFields.length > 0 && renderInvitedUsersNotOnApp()}
			{invitedUserFields.length === 1 && invitedUserNotOnAppFields.length === 0 && (
				<p className="text-sm text-destructive flex items-center gap-2">
					<AlertCircle className="h-4 w-4" />
					{t("Team must have at least one member besides you")}
				</p>
			)}
		</div>
	);

	return (
		<div className="space-y-8">
			<div className="space-y-2">
				<Progress value={(step / 4) * 100} className="h-2" />
				<div className="flex justify-between select-none text-sm text-muted-foreground px-1">
					<span className={cn(step >= 1 && "text-foreground font-medium")}>{t("Type")}</span>
					<span className={cn(step >= 2 && "text-foreground font-medium")}>
						{form.watch("type") === "team" ? t("Team") : t("Info")}
					</span>
					<span className={cn(step >= 3 && "text-foreground font-medium")}>{t("Rules")}</span>
					<span className={cn(step >= 4 && "text-foreground font-medium")}>{t("Payment")}</span>
				</div>
			</div>

			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				<input type="hidden" {...form.register("eventId")} />
				{step === 1 && renderTypeSelection()}
				{step === 2 && (
					<div className="space-y-4 fade-in-up">
						{form.watch("type") === "team" ? (
							renderTeamSection()
						) : (
							<div className="space-y-4">
								<h3 className="font-medium">{t("Your information")}</h3>
								<div className="p-4 border rounded-lg space-y-2">
									<div className="flex items-center gap-2">
										<UserIcon className="h-4 w-4 text-muted-foreground" />
										<span>{user.name}</span>
									</div>
									<div className="flex items-center gap-2">
										<Mail className="h-4 w-4 text-muted-foreground" />
										<span>{user.email}</span>
									</div>
									{currentUserClubs.length > 0 && (
										<div className="flex items-center gap-2">
											<Users className="h-4 w-4 text-muted-foreground" />
											<span>Član klubova: {currentUserClubs.map((c) => c.name).join(", ")}</span>
										</div>
									)}
								</div>
							</div>
						)}
					</div>
				)}

				{showAddMember && (
					<div className="space-y-4 p-4 bg-sidebar border">
						<h3 className="font-medium">{t("Add new member")}</h3>
						<div className="space-y-2">
							<Label htmlFor="memberName">{t("Full name")}</Label>
							<Input
								id="memberName"
								value={tempMember.name}
								onChange={(e) =>
									setTempMember((prev) => ({
										...prev,
										name: e.target.value,
									}))
								}
								placeholder={t("Enter full name")}
							/>
							{!tempMember.name && <p className="text-sm text-destructive">{t("Name is required")}</p>}
						</div>
						<div className="space-y-2">
							<Label htmlFor="memberEmail">{t("Email")}</Label>
							<Input
								id="memberEmail"
								type="email"
								value={tempMember.email}
								onChange={(e) =>
									setTempMember((prev) => ({
										...prev,
										email: e.target.value,
									}))
								}
								placeholder={"my@email.com"}
							/>
							<span className="text-sm text-muted-foreground">
								{t(
									"Using email address, people who don't have an account on the site will receive a registration invitation, but that registration is not mandatory.",
								)}
							</span>
							{tempMember.email && !isValidEmail(tempMember.email) && (
								<p className="text-sm text-destructive">{t("Email address is not valid")}</p>
							)}
						</div>
						<div className="flex gap-2 justify-end">
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									setShowAddMember(false);
									setTempMember({ name: "", email: "" });
								}}
							>
								{t("Cancel")}
							</Button>
							<Button
								type="button"
								onClick={addCustomMember}
								disabled={!(tempMember.name && tempMember.email && isValidEmail(tempMember.email))}
							>
								{t("Add")}
							</Button>
						</div>
					</div>
				)}

				{step === 3 && (
					<div className="fade-in-up space-y-4">
						<h3 className="font-medium">{t("Event rules")}</h3>
						<ScrollArea className="h-[400px] rounded-md border p-4">
							<div className="space-y-8">
								{event.rules?.map((rule, index) => (
									<div key={rule.id} className="space-y-2">
										<h4 className="font-medium">{rule.name}</h4>
										{rule.description && (
											<p className="text-sm text-muted-foreground">{rule.description}</p>
										)}
										<div
											className={cn(
												"prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0",
											)}
											// biome-ignore lint/security/noDangerouslySetInnerHtml: It's md content
											dangerouslySetInnerHTML={{
												__html: DOMPurify.sanitize(rule.content),
											}}
										/>
										{index < event.rules.length - 1 && <hr className="border-t" />}
									</div>
								))}
							</div>
						</ScrollArea>

						<div className="flex items-center space-x-2 mt-4">
							<Checkbox
								id="rules"
								defaultChecked={form.watch("rulesAccepted")}
								onCheckedChange={(checked) => form.setValue("rulesAccepted", checked as boolean)}
							/>
							<Label htmlFor="rules" className="text-sm cursor-pointer select-none">
								{t("I have read and accept all event rules")}
							</Label>
						</div>

						<p className="text-sm text-muted-foreground flex items-center gap-2">
							<AlertCircle className="h-4 w-4" />
							{t("Please read the rules carefully before accepting them")}
						</p>

						{form.formState.errors.rulesAccepted && (
							<p className="text-sm text-destructive flex items-center gap-2">
								<AlertCircle className="h-4 w-4" />
								{form.formState.errors.rulesAccepted.message}
							</p>
						)}
					</div>
				)}

				{step === 4 && (
					<div className="space-y-4 fade-in-up">
						<h3 className="font-medium">{t("Payment method")}</h3>
						<Tabs
							defaultValue="cash"
							onValueChange={(val) => form.setValue("paymentMethod", val as "cash" | "bank")}
							className="w-full"
						>
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="cash">{t("Cash")}</TabsTrigger>
								<TabsTrigger value="bank">{t("Bank")}</TabsTrigger>
							</TabsList>
							<TabsContent value="cash" className="p-4 border rounded-lg mt-2">
								{t("Cash payment on the day of the event")}
							</TabsContent>
							<TabsContent value="bank" className="p-4 border rounded-lg mt-2">
								{t("Bank: Example Bank\nIBAN: BA123456789\nPurpose: Event-{eventId}", {
									eventId: event.id,
								})}
							</TabsContent>
						</Tabs>
						{Object.keys(form.formState.errors).length > 0 && (
							<Alert variant="destructive" className="mt-4">
								<AlertDescription>
									{Object.values(form.formState.errors).map(
										(error) =>
											error.message && (
												<p
													key={error.message}
													className="text-sm text-destructive flex items-center gap-2"
												>
													<AlertCircle className="h-4 w-4" />
													{error.message}
												</p>
											),
									)}
								</AlertDescription>
							</Alert>
						)}
					</div>
				)}

				{/* Common error display */}
				{form.formState.errors.root && (
					<Alert variant="destructive">
						<AlertDescription>{form.formState.errors.root.message}</AlertDescription>
					</Alert>
				)}
				{/* Common navigation buttons */}
				{renderNavigation()}
			</form>
		</div>
	);
}
