"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { EventApplicationSchemaType } from "@/app/(public)/events/[id]/apply/_components/event-application-form.schema";
import { eventApplicationSchema } from "@/app/(public)/events/[id]/apply/_components/event-application-form.schema";
import type {
	Club,
	ClubRule,
	Event,
	EventInvite,
	EventRegistration,
} from "@prisma/client";
import type { User } from "better-auth";
import {
	CirclePlus,
	Users,
	AlertCircle,
	X,
	Plus,
	UserIcon,
	Mail,
	ChevronsUpDown,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import debounce from "lodash/debounce";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
	submitEventApplication,
	deleteRegistration,
} from "./event-application.actions";
import { isValidEmail } from "@/lib/utils"; // Add this utility function if not exists
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Editor } from "@/components/editor/editor";
import type { JSONContent } from "novel";

interface EventApplicationProps {
	existingApplication:
		| (EventRegistration & {
				invitedUsers: {
					email: string;
					image: string | null;
					callsign: string | null;
					name: string;
					id: string;
				}[];
				invitedUsersNotOnApp: Omit<EventInvite, "token">[];
		  })
		| null;
	event: Event & { rules: ClubRule[] };
	user: User;
	currentUserClubs: Club[];
}

type SearchUser = {
	id: string;
	name: string;
	email: string;
	image: string | null;
	callsign: string | null;
	clubMembership: { club: { name: string } }[];
};

export function EventApplicationForm({
	existingApplication,
	event,
	user,
	currentUserClubs,
}: EventApplicationProps) {
	const [step, setStep] = useState(1);
	const router = useRouter();

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
							// @ts-ignore Callsign exists on user, but heyyy.
							callsign: user.callsign || null,
						},
						...existingApplication.invitedUsers.filter((u) => u.id !== user.id),
					]
				: [
						{
							id: user.id,
							name: user.name,
							email: user.email,
							image: user.image,
							// @ts-ignore Callsign exists on user, but heyyy.

							callsign: user.callsign || null,
						},
					],
			invitedUsersNotOnApp: existingApplication?.invitedUsersNotOnApp || [],
			rulesAccepted: false,
			paymentMethod:
				(existingApplication?.paymentMethod as EventApplicationSchemaType["paymentMethod"]) ??
				"cash",
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

	const { fields: invitedUserFields, remove: removeInvitedUsers } =
		useFieldArray({
			control: form.control,
			name: "invitedUsers",
			rules: {
				required: true,
				minLength: form.watch("type") === "team" ? 2 : 1,
			},
		});

	const {
		fields: invitedUserNotOnAppFields,
		remove: removeInvitedUsersNotOnApp,
	} = useFieldArray({
		control: form.control,
		name: "invitedUsersNotOnApp",
	});

	const onSubmit = async (data: EventApplicationSchemaType) => {
		toast.promise(
			submitEventApplication({
				...data,
				eventId: event.id,
			}),
			{
				loading: "Slanje prijave...",
				success: () => {
					router.push(`/events/${event.id}`);
					return "Uspješno ste se prijavili na susret!";
				},
				error: (e) => e?.message ?? "Došlo je do greške prilikom prijave",
			},
		);
	};

	// Update validation message
	const handleNextStep = () => {
		if (step === 2 && form.watch("type") === "team") {
			const totalMembers =
				invitedUserFields.length + invitedUserNotOnAppFields.length;
			if (totalMembers < 2) {
				form.setError("invitedUsers", {
					type: "manual",
					message: "Tim mora imati najmanje 2 člana (Vi + jedan član)",
				});
				return;
			}
		}
		if (step === 3 && !form.watch("rulesAccepted")) {
			form.setError("rulesAccepted", {
				type: "manual",
				message: "Morate prihvatiti pravila susreta",
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
			const queryParams = new URLSearchParams({
				query: encodeURIComponent(query),
				onlyUsersClub: "true",
				ignoreCurrentUser: "true",
			});
			const response = await fetch(`/api/users?${queryParams.toString()}`);
			if (!response.ok) {
				throw new Error("Search failed");
			}
			const data = await response.json();
			setSearchResults(data);
		} catch (error) {
			console.error("Search failed:", error);
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
				email: user.email,
				image: user.image,
				callsign: user.callsign,
			},
		]);
		setSearchValue("");
		setOpen(false);
	};

	// Add delete handler
	const handleDelete = async () => {
		const confirm = window.confirm(
			"Da li ste sigurni da želite obrisati vašu prijavu? Ovo će također obrisati sve pozivnice koje ste poslali.",
		);

		if (confirm) {
			toast.promise(deleteRegistration({ eventId: event.id }), {
				loading: "Brisanje prijave...",
				success: () => {
					router.refresh();
					router.push(`/events/${event.id}`);
					return "Uspješno ste obrisali prijavu!";
				},
				error: "Došlo je do greške prilikom brisanja prijave",
			});
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
						Prijavi se samostalno
					</Button>
					<span className="text-gray-500 text-sm">
						{!event.allowFreelancers && currentUserClubs.length === 0
							? "Ne možete se prijaviti samostalno jer niste član nijednog kluba, a ovaj susret ne dozvoljava freelancer prijave."
							: "Odaberite ovu opciju ako dolazite sami na susret."}
					</span>
					{existingApplication !== null && (
						<>
							{form.watch("type") === "solo" && (
								<p className="text-sm text-primary">Trenutno odabrano</p>
							)}
							{form.watch("type") === "team" && (
								<p className="text-sm text-destructive">
									Prebacivanje na samostalnu prijavu će poništiti sve trenutne
									pozivnice članovima tima.
								</p>
							)}
						</>
					)}
				</div>

				<div className="flex gap-1 items-center">
					<hr className="flex-1 border-t-2 border-gray-300" />
					<span className="text-gray-500">ili</span>
					<hr className="flex-1 border-t-2 border-gray-300" />
				</div>

				<div className="flex flex-col gap-2">
					<Button
						type="button"
						className="flex items-center gap-2"
						onClick={() => handleTypeChange("team")}
					>
						<Users />
						Prijavi tim
					</Button>
					<span className="text-gray-500 text-sm">
						Odaberite ovu opciju ako dolazite s više igrača.
					</span>
					{existingApplication && form.watch("type") === "team" && (
						<p className="text-sm text-primary">Trenutno odabrano</p>
					)}
				</div>
			</div>

			{/* Desktop View */}
			<div className="hidden fade-in-up md:grid grid-cols-2 gap-8 h-[400px]">
				<div className="space-y-2">
					<button
						type="button"
						onClick={() => handleTypeChange("solo")}
						disabled={!event.allowFreelancers && currentUserClubs.length === 0}
						className="group disabled:cursor-not-allowed border relative flex flex-col items-center justify-center rounded-lg p-8 transition-all w-full"
					>
						{!event.allowFreelancers && currentUserClubs.length === 0 && (
							<div className="absolute backdrop-blur-[2px] p-4 inset-0 bg-black/30 dark:bg-black/80 rounded-lg flex items-center justify-center">
								<p className="text-sm text-center">
									Ne možete se prijaviti samostalno jer niste član nijednog
									kluba, a ovaj susret ne dozvoljava freelancer prijave.
								</p>
							</div>
						)}
						<div className="size-32 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
							<CirclePlus className="size-16 text-muted-foreground group-hover:text-primary transition-colors" />
						</div>
						<div className="mt-8 text-center">
							<h3 className="text-2xl font-semibold mb-2">
								Samostalna prijava
							</h3>
							<p className="text-muted-foreground">
								Odaberite ovu opciju ako dolazite sami na susret
							</p>
						</div>
						<div className="absolute inset-0 border-2 border-primary scale-105 opacity-0 rounded-lg group-hover:opacity-100 transition-all" />
					</button>
					{existingApplication !== null && (
						<>
							{form.watch("type") === "solo" && (
								<p className="text-sm text-primary">Trenutno odabrano</p>
							)}
							{form.watch("type") === "team" && (
								<p className="text-sm text-destructive">
									Prebacivanje na samostalnu prijavu će poništiti sve trenutne
									pozivnice članovima tima.
								</p>
							)}
						</>
					)}
				</div>

				<div className="space-y-2">
					<button
						type="button"
						onClick={() => handleTypeChange("team")}
						className="group border relative flex flex-col items-center justify-center rounded-lg p-8 transition-all w-full"
					>
						<div className="size-32 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
							<Users className="size-16 text-muted-foreground group-hover:text-primary transition-colors" />
						</div>
						<div className="mt-8 text-center">
							<h3 className="text-2xl font-semibold mb-2">Timska prijava</h3>
							<p className="text-muted-foreground">
								Odaberite ovu opciju ako dolazite s više igrača
							</p>
						</div>
						<div className="absolute inset-0 border-2 border-primary scale-105 opacity-0 rounded-lg group-hover:opacity-100 transition-all" />
					</button>
					{form.watch("type") === "team" && (
						<p className="text-sm text-primary">Trenutno odabrano</p>
					)}
				</div>
			</div>
		</div>
	);

	// Add delete button to navigation
	const renderNavigation = () => (
		<div className="flex gap-2 justify-between">
			{existingApplication && (
				<Button type="button" variant="destructive" onClick={handleDelete}>
					Obriši prijavu
				</Button>
			)}

			<div className="flex gap-2">
				{step > 1 && (
					<Button
						type="button"
						variant="outline"
						onClick={() => setStep(step - 1)}
					>
						Nazad
					</Button>
				)}
				{step < 4 && (
					<Button type="button" onClick={() => handleNextStep()}>
						Dalje
					</Button>
				)}

				{step === 4 && (
					<Button type="submit">
						{existingApplication ? "Sačuvaj izmjene" : "Pošalji prijavu"}
					</Button>
				)}
			</div>
		</div>
	);

	const renderInvitedUsers = () => (
		<div className="space-y-2">
			<h4 className="text-sm font-medium">Članovi s računom</h4>
			<span className="text-sm text-muted-foreground">
				Ove osobe imaju račun na aplikaciji, te će im se susret prikazati na
				dashboard-u. Tu ga mogu odbiti ili vidjeti više informacija o njemu.
			</span>
			{invitedUserFields.map((field, index) => (
				<div
					key={field.id}
					className="flex bg-sidebar items-center justify-between p-2 border rounded-md"
				>
					<div className="flex items-center gap-2">
						<Avatar className="h-8 w-8">
							<AvatarImage src={field.image || ""} />
							<AvatarFallback>
								{field.name.charAt(0).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div className="flex flex-col">
							<span className="font-medium">
								{field.name}
								{field.callsign && (
									<span className="text-muted-foreground">
										{" "}
										({field.callsign})
									</span>
								)}
							</span>
							<span className="text-sm text-muted-foreground">
								{field.email}
							</span>
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
			<h4 className="text-sm font-medium">Pozvani članovi (bez računa)</h4>
			<span className="text-sm text-muted-foreground">
				Članovi koji nemaju račun na aplikaciji koji će dobiti email pozivnicu.
				Nije je obavezno iskoristiti.
			</span>
			{invitedUserNotOnAppFields.map((field, index) => (
				<div
					key={field.id}
					className="flex bg-sidebar items-center justify-between p-2 border rounded-md"
				>
					<div className="flex items-center gap-2">
						<Avatar className="h-8 w-8">
							<AvatarFallback>
								<UserIcon className="h-4 w-4" />
							</AvatarFallback>
						</Avatar>
						<div className="flex flex-col">
							<span className="font-medium">{field.name}</span>
							<span className="text-sm text-muted-foreground">
								{field.email}
							</span>
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
			<h3 className="font-medium">Članovi tima</h3>
			<div className="flex gap-2">
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Button
							variant="outline"
							// biome-ignore lint/a11y/useSemanticElements: <explanation>
							role="combobox"
							aria-expanded={open}
							className="w-full justify-between"
						>
							{searchValue || "Pretraži igrače..."}
							<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent
						align="start"
						className="p-0 w-[var(--radix-popover-trigger-width)]"
					>
						<Command shouldFilter={false}>
							<CommandInput
								placeholder="Pretraži po imenu, emailu ili callsignu..."
								value={searchValue}
								onValueChange={handleSearch}
							/>
							<CommandList>
								{isSearching && (
									<CommandEmpty className="flex items-center h-32 justify-center">
										<Loader2 className="h-4 w-4 animate-spin" />
									</CommandEmpty>
								)}
								{!isSearching && searchValue.length < 2 && (
									<CommandEmpty>Unesite najmanje 2 karaktera...</CommandEmpty>
								)}
								{!isSearching &&
									searchValue.length >= 2 &&
									searchResults.length === 0 && (
										<CommandEmpty>
											<div className="p-4 text-sm space-y-4">
												<p>Nema rezultata za "{searchValue}"</p>
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
													Dodaj novog člana
												</Button>
											</div>
										</CommandEmpty>
									)}
								<CommandGroup>
									{searchResults.map((user) => {
										const isAlreadyAdded = invitedUserFields.some(
											(field) => field.id === user.id,
										);
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
												className={`flex items-center gap-2 p-2 ${
													isAlreadyAdded ? "opacity-50 cursor-not-allowed" : ""
												}`}
											>
												<Avatar className="h-8 w-8">
													<AvatarImage src={user.image || ""} />
													<AvatarFallback>
														{user.name.charAt(0).toUpperCase()}
													</AvatarFallback>
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
																- Već dodan u tim
															</span>
														)}
													</span>
													<span className="text-sm text-muted-foreground">
														{user.email}
													</span>
													{user.clubMembership.length > 0 && (
														<span className="text-xs text-muted-foreground">
															Član:{" "}
															{user.clubMembership
																.map((m) => m.club.name)
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
			{invitedUserFields.length === 1 &&
				invitedUserNotOnAppFields.length === 0 && (
					<p className="text-sm text-destructive flex items-center gap-2">
						<AlertCircle className="h-4 w-4" />
						Tim mora imati barem jednog člana, osim Vas
					</p>
				)}
		</div>
	);

	return (
		<div className="space-y-8">
			<div className="space-y-2">
				<Progress value={(step / 4) * 100} className="h-2" />
				<div className="flex justify-between select-none text-sm text-muted-foreground px-1">
					<span className={step >= 1 ? "text-foreground font-medium" : ""}>
						Tip
					</span>
					<span className={step >= 2 ? "text-foreground font-medium" : ""}>
						{form.watch("type") === "team" ? "Tim" : "Info"}
					</span>
					<span className={step >= 3 ? "text-foreground font-medium" : ""}>
						Pravila
					</span>
					<span className={step >= 4 ? "text-foreground font-medium" : ""}>
						Plaćanje
					</span>
				</div>
			</div>

			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				{step === 1 && renderTypeSelection()}
				{step === 2 && (
					<div className="space-y-4 fade-in-up">
						{form.watch("type") === "team" ? (
							renderTeamSection()
						) : (
							<div className="space-y-4">
								<h3 className="font-medium">Vaši podaci</h3>
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
											<span>
												Član klubova:{" "}
												{currentUserClubs.map((c) => c.name).join(", ")}
											</span>
										</div>
									)}
								</div>
							</div>
						)}
					</div>
				)}

				{showAddMember && (
					<div className="space-y-4 p-4 bg-sidebar border">
						<h3 className="font-medium">Dodaj novog člana</h3>
						<div className="space-y-2">
							<Label htmlFor="memberName">Ime i prezime</Label>
							<Input
								id="memberName"
								value={tempMember.name}
								onChange={(e) =>
									setTempMember((prev) => ({ ...prev, name: e.target.value }))
								}
								placeholder="Unesite puno ime i prezime"
							/>
							{!tempMember.name && (
								<p className="text-sm text-destructive">Ime je obavezno</p>
							)}
						</div>
						<div className="space-y-2">
							<Label htmlFor="memberEmail">Email</Label>
							<Input
								id="memberEmail"
								type="email"
								value={tempMember.email}
								onChange={(e) =>
									setTempMember((prev) => ({ ...prev, email: e.target.value }))
								}
								placeholder="Unesite email adresu"
							/>
							<span className="text-sm text-muted-foreground">
								Koristeći email adresu, osobe koje nemaju račun na sajtu će
								dobiti pozivnicu za registraciju, ali ta registracija nije
								obavezna.
							</span>
							{tempMember.email && !isValidEmail(tempMember.email) && (
								<p className="text-sm text-destructive">
									Email adresa nije validna
								</p>
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
								Odustani
							</Button>
							<Button
								type="button"
								onClick={addCustomMember}
								disabled={
									!(
										tempMember.name &&
										tempMember.email &&
										isValidEmail(tempMember.email)
									)
								}
							>
								Dodaj člana
							</Button>
						</div>
					</div>
				)}

				{step === 3 && (
					<div className="fade-in-up space-y-4">
						<h3 className="font-medium">Pravila susreta</h3>
						<ScrollArea className="h-[400px] rounded-md border p-4">
							<div className="space-y-8">
								{event.rules?.map((rule, index) => (
									<div key={rule.id} className="space-y-2">
										<h4 className="font-medium">{rule.name}</h4>
										{rule.description && (
											<p className="text-sm text-muted-foreground">
												{rule.description}
											</p>
										)}
										<Editor
											editable={false}
											initialValue={rule.content as JSONContent}
											onChange={() => {}}
										/>
										{index < event.rules.length - 1 && (
											<hr className="border-t" />
										)}
									</div>
								))}
							</div>
						</ScrollArea>

						<div className="flex items-center space-x-2 mt-4">
							<Checkbox
								id="rules"
								defaultChecked={form.watch("rulesAccepted")}
								onCheckedChange={(checked) =>
									form.setValue("rulesAccepted", checked as boolean)
								}
							/>
							<Label
								htmlFor="rules"
								className="text-sm cursor-pointer select-none"
							>
								Pročitao/la sam i prihvatam sva pravila susreta
							</Label>
						</div>

						<p className="text-sm text-muted-foreground flex items-center gap-2">
							<AlertCircle className="h-4 w-4" />
							Molimo vas da detaljno pročitate pravila prije nego što ih
							prihvatite
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
						<h3 className="font-medium">Način plaćanja</h3>
						<Tabs
							defaultValue="cash"
							onValueChange={(val) =>
								form.setValue("paymentMethod", val as "cash" | "bank")
							}
							className="w-full"
						>
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="cash">Gotovina</TabsTrigger>
								<TabsTrigger value="bank">Banka</TabsTrigger>
							</TabsList>
							<TabsContent value="cash" className="p-4 border rounded-lg mt-2">
								Plaćanje gotovinom na dan susreta
							</TabsContent>
							<TabsContent value="bank" className="p-4 border rounded-lg mt-2">
								Banka: Example Bank
								<br />
								IBAN: BA123456789
								<br />
								Svrha: Susret-{event.id}
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
						<AlertDescription>
							{form.formState.errors.root.message}
						</AlertDescription>
					</Alert>
				)}
				{/* Common navigation buttons */}
				{renderNavigation()}
			</form>
		</div>
	);
}
