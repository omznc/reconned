"use client";

import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useCallback, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { EventApplicationSchemaType } from "@/app/(public)/events/[id]/apply/_components/event-application-schema";
import { eventApplicationSchema } from "@/app/(public)/events/[id]/apply/_components/event-application-schema";
import type { Club, Event } from "@prisma/client";
import type { User } from "better-auth";
import { useRouter } from "next/navigation";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface EventApplicationProps {
	event: Event;
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
	event,
	user,
	currentUserClubs,
}: EventApplicationProps) {
	const [step, setStep] = useState(1);
	const router = useRouter();
	const [memberName, setMemberName] = useState("");

	// Update form initialization
	const form = useForm<EventApplicationSchemaType>({
		resolver: zodResolver(eventApplicationSchema),
		defaultValues: {
			applicationType: "solo",
			teamMembers: [],
			rulesAccepted: false,
			paymentMethod: "cash",
		},
	});

	// Initialize current user as first team member when switching to team mode
	const handleTypeChange = (type: "solo" | "team") => {
		form.setValue("applicationType", type);
		if (type === "team") {
			form.setValue("teamMembers", [
				{
					fullName: user.name,
					userId: user.id,
					email: user.email,
					image: user.image,
					// @ts-expect-error Callsign exists on user, but heyyy.
					callsign: user.callsign || null,
					clubMembership: currentUserClubs.map((club) => ({
						club: { name: club.name },
					})),
				},
			]);
		} else {
			form.setValue("teamMembers", []);
		}
		setStep(2);
	};

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "teamMembers",
		rules: {
			required: true,
			minLength: form.watch("applicationType") === "team" ? 2 : 1,
		},
	});

	const onSubmit = (data: EventApplicationSchemaType) => {
		console.log(data);
		router.push(`/events/${event.id}`);
	};

	// Update validation message
	const handleNextStep = () => {
		if (step === 2 && form.watch("applicationType") === "team") {
			if (fields.length < 2) {
				form.setError("teamMembers", {
					type: "manual",
					message: "Tim mora imati najmanje 2 člana (Vi + jedan član)",
				});
				return;
			}

			form.trigger("teamMembers").then((isValid) => {
				if (isValid) {
					setStep(3);
				}
			});
			return;
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

	const addMember = () => {
		if (memberName.trim()) {
			append({ fullName: memberName.trim() });
			setMemberName("");
		}
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

	const renderTeamMember = (
		field: EventApplicationSchemaType["teamMembers"][number],
		index: number,
	) => (
		<div
			key={JSON.stringify(field)}
			className="flex items-center bg-sidebar justify-between p-2 border rounded-md"
		>
			<div className="flex items-center gap-2">
				<Avatar className="h-8 w-8">
					{field.userId ? (
						<>
							<AvatarImage src={field.image || ""} alt={field.fullName} />
							<AvatarFallback>
								{field.fullName.charAt(0).toUpperCase()}
							</AvatarFallback>
						</>
					) : (
						<AvatarFallback>
							<UserIcon className="h-4 w-4" />
						</AvatarFallback>
					)}
				</Avatar>
				<div className="flex flex-col">
					<span className="font-medium">
						{field.fullName}
						{field.callsign && (
							<span className="ml-1 text-muted-foreground">
								{" "}
								({field.callsign})
							</span>
						)}
						{index === 0 && (
							<span className="text-xs ml-1 text-muted-foreground">(Vi)</span>
						)}
					</span>
					<span className="text-sm text-muted-foreground">
						{field.userId ? field.email : "Korisnik nema račun"}
					</span>
					{field.clubMembership && field.clubMembership.length > 0 && (
						<span className="text-xs text-muted-foreground">
							Član: {field.clubMembership.map((m) => m.club.name).join(", ")}
						</span>
					)}
				</div>
			</div>
			{index > 0 && ( // Only show remove button for non-first members
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={() => remove(index)}
					className="h-8 w-8 text-destructive hover:text-destructive"
				>
					<X className="h-4 w-4" />
				</Button>
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
						{form.watch("applicationType") === "team" ? "Tim" : "Info"}
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
				{step === 1 && (
					<div className="space-y-4">
						{/* Mobile View */}
						<div className="flex fade-in-up flex-col gap-4 w-full md:hidden">
							{/* Existing mobile buttons */}
							<div className="flex flex-col gap-2">
								<Button
									type="button"
									className="flex items-center gap-2"
									onClick={() => handleTypeChange("solo")}
									disabled={
										!event.allowFreelancers && currentUserClubs.length === 0
									}
								>
									<CirclePlus />
									Prijavi se samostalno
								</Button>
								<span className="text-gray-500 text-sm">
									{!event.allowFreelancers && currentUserClubs.length === 0
										? "Ne možete se prijaviti samostalno jer niste član nijednog kluba, a ovaj susret ne dozvoljava freelancer prijave."
										: "Odaberite ovu opciju ako dolazite sami na susret."}
								</span>
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
							</div>
						</div>

						{/* Desktop View */}
						<div className="hidden fade-in-up md:grid grid-cols-2 gap-8 h-[400px]">
							<button
								type="button"
								onClick={() => handleTypeChange("solo")}
								disabled={
									!event.allowFreelancers && currentUserClubs.length === 0
								}
								className="!disabled:group disabled:cursor-not-allowed border relative flex flex-col items-center justify-center rounded-lg p-8 transition-all"
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

							<button
								type="button"
								onClick={() => handleTypeChange("team")}
								className="group border relative flex flex-col items-center justify-center rounded-lg p-8 transition-all"
							>
								<div className="size-32 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
									<Users className="size-16 text-muted-foreground group-hover:text-primary transition-colors" />
								</div>
								<div className="mt-8 text-center">
									<h3 className="text-2xl font-semibold mb-2">
										Timska prijava
									</h3>
									<p className="text-muted-foreground">
										Odaberite ovu opciju ako dolazite s više igrača
									</p>
								</div>
								<div className="absolute inset-0 border-2 border-primary scale-105 opacity-0 rounded-lg group-hover:opacity-100 transition-all" />
							</button>
						</div>
					</div>
				)}

				{step === 2 && (
					<div className="space-y-4 fade-in-up">
						{form.watch("applicationType") === "team" ? (
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
														<CommandEmpty>
															Unesite najmanje 2 karaktera...
														</CommandEmpty>
													)}
													{!isSearching &&
														searchValue.length >= 2 &&
														searchResults.length === 0 && (
															<CommandEmpty>
																<span className="p-2">
																	Nema rezultata. Možete idalje dodati{" "}
																	{searchValue} kao člana tima ako je to njihovo
																	puno ime i prezime.
																</span>
															</CommandEmpty>
														)}
													<CommandGroup>
														{searchResults.map((user) => {
															const isAlreadyAdded = fields.some(
																(field) => field.userId === user.id,
															);
															return (
																<CommandItem
																	key={user.id}
																	value={user.id}
																	onSelect={() => {
																		if (!isAlreadyAdded) {
																			append({
																				fullName: user.name,
																				userId: user.id,
																				email: user.email,
																				image: user.image,
																				callsign: user.callsign,
																				clubMembership: user.clubMembership,
																			});
																			setSearchValue("");
																			setOpen(false);
																		}
																	}}
																	className={`flex items-center gap-2 p-2 ${
																		isAlreadyAdded
																			? "opacity-50 cursor-not-allowed"
																			: ""
																	}`}
																	disabled={isAlreadyAdded}
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
									<Button
										type="button"
										onClick={() => {
											if (searchValue.trim()) {
												append({ fullName: searchValue.trim() });
												setSearchValue("");
												setOpen(false);
											}
										}}
										size="icon"
									>
										<Plus className="h-4 w-4" />
									</Button>
								</div>
								{fields.length > 0 && (
									<ScrollArea className="h-fit max-h-[300px] overflow-y-auto w-full rounded-md">
										<div className="space-y-2 flex flex-col">
											{fields.map((field, index) =>
												renderTeamMember(field, index),
											)}
										</div>
									</ScrollArea>
								)}

								{fields.length === 1 && (
									<p className="text-sm text-destructive flex items-center gap-2">
										<AlertCircle className="h-4 w-4" />
										Tim mora imati barem jednog člana, osim Vas
									</p>
								)}
							</div>
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

				{step === 3 && (
					<div className="fade-in-up space-y-4 border rounded-lg p-4">
						<h3 className="font-medium">Pravila susreta</h3>
						<ul className="list-disc pl-4 space-y-2 text-sm">
							<li>Obavezno nošenje zaštitne opreme za oči cijelo vrijeme</li>
							<li>Minimalna energija 1.5J za replike dugih cijevi</li>
							<li>Minimalna energija 1.0J za replike kratkih cijevi</li>
							<li>Zabranjeno korištenje pirotehničkih sredstava</li>
							<li>Dolazak najkasnije 30 minuta prije početka</li>
						</ul>

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
								Prihvatam pravila susreta
							</Label>
						</div>

						{form.formState.errors.rulesAccepted && (
							<p className="text-sm text-destructive flex items-center gap-2">
								<AlertCircle className="h-4 w-4" />
								{form.formState.errors.rulesAccepted.message}
							</p>
						)}

						{form.formState.errors.teamMembers && (
							<Alert variant="destructive" className="mt-4">
								<AlertDescription>
									{form.formState.errors.teamMembers.message}
								</AlertDescription>
							</Alert>
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
				{step > 1 && (
					<div className="flex gap-2 justify-between">
						<Button
							type="button"
							variant="outline"
							onClick={() => setStep(step - 1)}
						>
							Nazad
						</Button>

						{step < 4 && (
							<Button type="button" onClick={() => handleNextStep()}>
								Dalje
							</Button>
						)}

						{step === 4 && <Button type="submit">Pošalji prijavu</Button>}
					</div>
				)}
			</form>
		</div>
	);
}
