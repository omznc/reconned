"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { EventApplicationSchemaType } from "@/app/(public)/events/[id]/apply/_components/event-application-schema";
import { eventApplicationSchema } from "@/app/(public)/events/[id]/apply/_components/event-application-schema";
import type { Club, Event } from "@prisma/client";
import type { User } from "better-auth";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import {
	CirclePlus,
	Users,
	AlertCircle,
	X,
	Plus,
	UserIcon,
	Mail,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EventApplicationProps {
	event: Event;
	user: User;
	currentUserClubs: Club[];
}

export function EventApplication(props: EventApplicationProps) {
	const [step, setStep] = useState(1);
	const [open, setOpen] = useState(false);
	const searchParams = useSearchParams();
	const [memberName, setMemberName] = useState(""); // Add this state

	useEffect(() => {
		if (searchParams.get("signup") === "true") {
			setOpen(true);
		}
	}, [searchParams]);

	const form = useForm<EventApplicationSchemaType>({
		resolver: zodResolver(eventApplicationSchema),
		defaultValues: {
			applicationType: "solo",
			teamMembers: [],
			rulesAccepted: false,
			paymentMethod: "cash",
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "teamMembers",
	});

	const onSubmit = (data: EventApplicationSchemaType) => {
		console.log(data);
		setOpen(false);
	};

	const handleNextStep = () => {
		if (step === 2 && form.watch("applicationType") === "team") {
			// Set error immediately if no members
			if (!fields.length) {
				form.setError("teamMembers", {
					type: "manual",
					message: "Tim mora imati barem jednog člana",
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

	return (
		<>
			<Button
				onClick={() => setOpen(true)}
				variant="outline"
				size="sm"
				className="w-full md:w-auto"
			>
				Prijavi se
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent
					className="sm:max-w-[425px]"
					onPointerDownOutside={(e) => e.preventDefault()}
				>
					<DialogHeader>
						<DialogTitle>Prijava na susret</DialogTitle>
					</DialogHeader>

					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						{step === 1 && (
							<div className="space-y-4">
								<div className="flex flex-col gap-4 w-full">
									<div className="flex flex-col gap-2 relative">
										<Button
											type="button"
											className="flex items-center gap-2"
											onClick={() => {
												form.setValue("applicationType", "solo");
												setStep(2);
											}}
											disabled={!props.event.allowFreelancers}
										>
											<CirclePlus />
											Prijavi se samostalno
										</Button>
										{!props.event.allowFreelancers && (
											<div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-md flex items-center justify-center">
												<p className="text-sm text-muted-foreground px-4 text-center">
													Ovaj susret ne dozvoljava samostalne prijave
												</p>
											</div>
										)}
										<span className="text-gray-500 text-sm">
											Odaberite ovu opciju ako dolazite sami na susret.
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
											onClick={() => {
												form.setValue("applicationType", "team");
												setStep(2);
											}}
										>
											<Users />
											Prijavi tim
										</Button>
										<span className="text-gray-500 text-sm">
											Odaberite ovu opciju ako dolazite s više igrača.
										</span>
									</div>
								</div>
							</div>
						)}

						{step === 2 && (
							<div className="space-y-4">
								{form.watch("applicationType") === "team" ? (
									<div className="space-y-4">
										<h3 className="font-medium">Članovi tima</h3>
										<div className="flex gap-2">
											<Input
												placeholder="Ime i prezime"
												value={memberName}
												onChange={(e) => setMemberName(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														e.preventDefault();
														addMember();
													}
												}}
											/>
											<Button type="button" size="icon" onClick={addMember}>
												<Plus className="h-4 w-4" />
											</Button>
										</div>

										{fields.length > 0 && (
											<ScrollArea className="h-[120px] w-full rounded-md border">
												<div className="space-y-2 p-4">
													{fields.map((field, index) => (
														<div
															key={field.id}
															className="flex items-center justify-between p-2 border rounded-md"
														>
															<span>{field.fullName}</span>
															<Button
																type="button"
																variant="ghost"
																size="icon"
																onClick={() => remove(index)}
																className="h-8 w-8 text-destructive hover:text-destructive"
															>
																<X className="h-4 w-4" />
															</Button>
														</div>
													))}
												</div>
											</ScrollArea>
										)}

										{!fields.length && (
											<p className="text-sm text-destructive flex items-center gap-2">
												<AlertCircle className="h-4 w-4" />
												Tim mora imati barem jednog člana
											</p>
										)}
									</div>
								) : (
									<div className="space-y-4">
										<h3 className="font-medium">Vaši podaci</h3>
										<div className="p-4 border rounded-lg space-y-2">
											<div className="flex items-center gap-2">
												<UserIcon className="h-4 w-4 text-muted-foreground" />
												<span>{props.user.name}</span>
											</div>
											<div className="flex items-center gap-2">
												<Mail className="h-4 w-4 text-muted-foreground" />
												<span>{props.user.email}</span>
											</div>
											{props.currentUserClubs.length > 0 && (
												<div className="flex items-center gap-2">
													<Users className="h-4 w-4 text-muted-foreground" />
													<span>
														Član klubova:{" "}
														{props.currentUserClubs
															.map((c) => c.name)
															.join(", ")}
													</span>
												</div>
											)}
										</div>
									</div>
								)}
							</div>
						)}

						{step === 3 && (
							<div className="space-y-4 border rounded-lg p-4">
								<h3 className="font-medium">Pravila susreta</h3>
								<ul className="list-disc pl-4 space-y-2 text-sm">
									<li>
										Obavezno nošenje zaštitne opreme za oči cijelo vrijeme
									</li>
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
							<div className="space-y-4">
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
									<TabsContent
										value="cash"
										className="p-4 border rounded-lg mt-2"
									>
										Plaćanje gotovinom na dan susreta
									</TabsContent>
									<TabsContent
										value="bank"
										className="p-4 border rounded-lg mt-2"
									>
										Banka: Example Bank
										<br />
										IBAN: BA123456789
										<br />
										Svrha: Susret-{props.event.id}
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
				</DialogContent>
			</Dialog>
		</>
	);
}
