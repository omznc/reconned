"use client";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type * as z from "zod";

import {
	createEvent,
	deleteEvent,
	deleteEventImage,
	getEventImageUploadUrl,
} from "@/app/dashboard/(club)/[clubId]/events/create/_components/create-event-form.action";
import { createEventFormSchema } from "@/app/dashboard/(club)/[clubId]/events/create/_components/create-event-form.schema";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	DateTimePicker,
	initHourFormat,
} from "@/components/ui/date-time-picker";
import {
	FileInput,
	FileUploader,
	FileUploaderContent,
	FileUploaderItem,
} from "@/components/ui/file-upload";
import { Switch } from "@/components/ui/switch";
import type { Event } from "@prisma/client";
import { bs } from "date-fns/locale";
import {
	ArrowUpRight,
	Calendar as CalendarIcon,
	CloudUpload,
	Eye,
	Loader,
	Trash,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
	HoverCard,
	HoverCardTrigger,
	HoverCardContent,
} from "@/components/ui/hover-card";
import Image from "next/image";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { AnimatedNumber } from "@/components/animated-number";

export const MapComponent = dynamic(
	() => import("@/components/map-component").then((mod) => mod.MapComponent),
	{
		ssr: false,
	},
);

interface CreateEventFormProps {
	event: Event | null;
}

function EventTimelineDescription({
	dateRegistrationsOpen,
	dateRegistrationsClose,
	dateStart,
	dateEnd,
}: {
	dateRegistrationsOpen: Date;
	dateRegistrationsClose: Date;
	dateStart: Date;
	dateEnd: Date;
}) {
	// Add validation check
	if (
		!(dateRegistrationsOpen && dateRegistrationsClose && dateStart && dateEnd)
	) {
		return null;
	}

	const now = new Date();

	const regOpenDiff = dateRegistrationsOpen.getTime() - now.getTime();
	const regCloseDiff = dateRegistrationsClose.getTime() - now.getTime();
	const startDiff = dateStart.getTime() - now.getTime();
	const eventDuration =
		(dateEnd.getTime() - dateStart.getTime()) / (1000 * 60 * 60);

	const parts = [] as ReactNode[];

	if (regOpenDiff > 0) {
		const days = Math.floor(regOpenDiff / (1000 * 60 * 60 * 24));
		parts.push(
			<span key="regOpen">
				Registracije se otvaraju za <AnimatedNumber value={days} /> dan/a
			</span>,
		);
	} else if (regCloseDiff > 0) {
		parts.push(<span key="regOpen">Registracije su otvorene</span>);
	} else {
		parts.push(<span key="regClose">Registracije su zatvorene</span>);
	}

	if (startDiff > 0) {
		const days = Math.floor(startDiff / (1000 * 60 * 60 * 24));
		parts.push(
			<span key="start">
				, susret počinje za <AnimatedNumber value={days} /> dan/a
			</span>,
		);
	} else {
		parts.push(<span key="start">, susret je počeo</span>);
	}

	parts.push(
		<span key="duration">
			, traje <AnimatedNumber value={Math.round(eventDuration)} /> sati/a.
		</span>,
	);

	return <p className="text-sm text-muted-foreground min-h-[50px]">{parts}</p>;
}

export default function CreateEventForm(props: CreateEventFormProps) {
	const [files, setFiles] = useState<File[] | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isDeletingImage, setIsDeletingImage] = useState(false);
	const confirm = useConfirm();

	const dropZoneConfig = {
		maxFiles: 1,
		maxSize: 1024 * 1024 * 4,
		accept: {
			"image/jpeg": ["jpg", "jpeg"],
			"image/png": ["png"],
		},
	};

	const router = useRouter();
	const clubId = useParams<{ clubId: string }>().clubId;

	const startDate = new Date();
	startDate.setDate(startDate.getDate() + 15);

	const endDate = new Date(startDate);
	endDate.setDate(endDate.getDate() + 1);

	const registrationCloseDate = new Date(startDate);
	registrationCloseDate.setHours(registrationCloseDate.getHours() - 2);

	const form = useForm<z.infer<typeof createEventFormSchema>>({
		resolver: zodResolver(createEventFormSchema),
		defaultValues: {
			eventId: props.event?.id || "",
			clubId: props.event?.clubId || clubId || "",
			name: props.event?.name || "",
			description: props.event?.description || "",
			costPerPerson: props.event?.costPerPerson || 0,
			location: props.event?.location || "",
			googleMapsLink: props.event?.googleMapsLink || "",
			dateStart: props.event?.dateStart || startDate,
			dateEnd: props.event?.dateEnd || endDate,
			dateRegistrationsOpen: props.event?.dateRegistrationsOpen || new Date(),
			dateRegistrationsClose:
				props.event?.dateRegistrationsClose || registrationCloseDate,
			coverImage: props.event?.coverImage || "",
			isPrivate: props.event?.isPrivate,
			allowFreelancers: props.event?.allowFreelancers,
			hasBreakfast: props.event?.hasBreakfast,
			hasLunch: props.event?.hasLunch,
			hasDinner: props.event?.hasDinner,
			hasSnacks: props.event?.hasSnacks,
			hasDrinks: props.event?.hasDrinks,
			hasPrizes: props.event?.hasPrizes,
			// biome-ignore lint/suspicious/noExplicitAny: I'll eventually handle this
			mapData: (props.event?.mapData as any) || { areas: [], pois: [] },
		},
		mode: "onChange",
	});

	useEffect(() => {
		form.reset();
	}, []);

	// Add this effect after the form initialization
	useEffect(() => {
		const subscription = form.watch((value, { name }) => {
			if (name === "dateStart") {
				const startDate = value.dateStart as Date;
				if (!startDate) {
					return;
				}

				const newEndDate = new Date(startDate);
				newEndDate.setDate(newEndDate.getDate() + 1);

				const newRegistrationCloseDate = new Date(startDate);
				newRegistrationCloseDate.setHours(
					newRegistrationCloseDate.getHours() - 2,
				);

				form.setValue("dateEnd", newEndDate, { shouldValidate: true });
				form.setValue("dateRegistrationsClose", newRegistrationCloseDate, {
					shouldValidate: true,
				});
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	}, [form]);

	async function onSubmit(values: z.infer<typeof createEventFormSchema>) {
		setIsLoading(true);
		try {
			const event = await createEvent(values);

			if (!event?.data || event.serverError) {
				toast.error("Došlo je do greške prilikom spašavanja podataka");
				return;
			}

			if (files && files.length > 0) {
				const resp = await getEventImageUploadUrl({
					file: {
						type: files[0].type,
						size: files[0].size,
					},
					eventId: event.data.id,
					clubId: clubId,
				});

				if (!resp?.data?.url) {
					toast.error("Došlo je do greške prilikom uploada slike");
					return;
				}

				await fetch(resp.data?.url, {
					method: "PUT",
					body: files[0],
					headers: {
						"Content-Type": files[0].type,
						"Content-Length": files[0].size.toString(),
					},
				});

				values.coverImage = resp.data.cdnUrl;
				await createEvent({
					...values,
					eventId: event.data.id,
				});
			}
			router.push(`/dashboard/${clubId}/events/${event.data.id}`);

			setFiles([]);
			toast.success("Podataci o susretu su sačuvani");
		} catch (error) {
			toast.error("Došlo je do greške prilikom spašavanja susreta");
		}
		setIsLoading(false);
	}

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="space-y-4 max-w-3xl"
			>
				{props.event?.id && (
					<Alert className="flex flex-col md:flex-row gap-1 justify-between -z-0">
						<div className="flex flex-col">
							<AlertTitle>Mijenjate susret</AlertTitle>
							<AlertDescription>
								Ovaj susret je već kreiran, trenutno ga uređujete.
							</AlertDescription>
						</div>
						<div className="flex gap-1">
							<Button
								variant={"destructive"}
								type="button"
								disabled={isLoading}
								className="w-fit"
								onClick={async () => {
									const resp = await confirm({
										title: "Jeste li sigurni?",
										body: "Ako obrišete susret, nećete ga moći vratiti nazad.",
										actionButtonVariant: "destructive",
										actionButton: `Obriši ${props.event?.name}`,
										cancelButton: "Ne, vrati se",
									});
									if (resp) {
										setIsLoading(true);
										await deleteEvent({
											eventId: props.event?.id ?? "",
											clubId: clubId,
										});
										setIsLoading(false);
									}
								}}
							>
								<Trash className="size-4" />
								{isLoading ? (
									<Loader className="animate-spin size-4" />
								) : (
									"Obriši susret"
								)}
							</Button>
							<Button variant="outline" asChild={true}>
								<Link
									className="flex items-center gap-1"
									href={`/dashboard/${clubId}/events/${props.event.id}`}
								>
									<Eye className="size-4" />
									Pregled
								</Link>
							</Button>
						</div>
					</Alert>
				)}
				<div>
					<h3 className="text-lg font-semibold">Općenito</h3>
				</div>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Ime*</FormLabel>
							<FormControl>
								<Input placeholder="Food Wars 24" type="text" {...field} />
							</FormControl>
							<FormDescription>Ovo je naziv vašeg susreta.</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Opis*</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Ponesite pribor za jelo..."
									className="min-h-32"
									{...field}
								/>
							</FormControl>
							<FormDescription>
								Opis susreta. Ovo može biti priča, briefing, ili bilo šta što ne
								spada u druge kategorije.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="coverImage"
					render={() => (
						<FormItem>
							<FormLabel>Slika susreta</FormLabel>
							<FormControl>
								<FileUploader
									value={files}
									onValueChange={setFiles}
									dropzoneOptions={dropZoneConfig}
									className="relative bg-background p-0.5"
								>
									{(!files || files.length === 0) && (
										<FileInput
											key={`file-input-${files?.length}-${files?.[0]?.name}`}
											id="fileInput"
											className="outline-dashed outline-1 outline-slate-500"
										>
											<div className="flex items-center justify-center flex-col p-8 w-full ">
												<CloudUpload className="text-gray-500 w-10 h-10" />
												<p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
													<span className="font-semibold">
														Kliknite da dodate fajl
													</span>
													, ili ga samo prebacite ovde
												</p>
												<p className="text-xs text-gray-500 dark:text-gray-400">
													Dozvoljeni formati: JPG, JPEG, PNG
												</p>
											</div>
										</FileInput>
									)}
									<FileUploaderContent>
										{files &&
											files.length > 0 &&
											files.map((file, i) => (
												<FileUploaderItem
													className="p-2 size-fit -ml-1"
													key={file.name}
													index={i}
												>
													<img
														src={URL.createObjectURL(file)}
														alt={file.name}
														className="h-[100px] mr-4 w-auto object-fit"
													/>
												</FileUploaderItem>
											))}
									</FileUploaderContent>
								</FileUploader>
							</FormControl>
							<FormDescription>
								Imate neku sliku koja bi bila savršena za ovaj susret? Dodajte
								je.
							</FormDescription>
						</FormItem>
					)}
				/>
				{props.event?.id && props.event?.coverImage && (
					<HoverCard openDelay={100}>
						<HoverCardTrigger>
							<Button
								type="button"
								disabled={isLoading}
								variant={"destructive"}
								onClick={async () => {
									const resp = await confirm({
										title: "Jeste li sigurni?",
										body: "Ako obrišete sliku, nećete je moći vratiti nazad.",
										actionButtonVariant: "destructive",
										actionButton: "Obriši sliku",
										cancelButton: "Ne, vrati se",
									});

									if (!resp) {
										return;
									}

									setIsDeletingImage(true);
									await deleteEventImage({
										eventId: props.event?.id as string,
										clubId: clubId,
									});
									setIsDeletingImage(false);
								}}
								className="mt-1"
							>
								<Trash className="size-4" />

								{isDeletingImage ? (
									<Loader className="size-5 animate-spin" />
								) : (
									"Obriši trenutnu sliku"
								)}
							</Button>
						</HoverCardTrigger>
						<HoverCardContent className="size-full mb-8">
							<Image
								src={`${props.event.coverImage}?v=${props.event.updatedAt}`}
								alt="Club logo"
								width={200}
								height={200}
							/>
						</HoverCardContent>
					</HoverCard>
				)}

				<FormField
					control={form.control}
					name="costPerPerson"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Kotizacija/cijena</FormLabel>
							<FormControl>
								<Input placeholder="20" type="number" {...field} />
							</FormControl>
							<FormDescription>
								Koliko susret košta po igraču, u KM?
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div>
					<h3 className="text-lg font-semibold">Vrijeme</h3>
					{!(
						form.formState.errors.dateRegistrationsOpen ||
						form.formState.errors.dateRegistrationsClose ||
						form.formState.errors.dateStart ||
						form.formState.errors.dateEnd
					) &&
						form.watch("dateRegistrationsOpen") &&
						form.watch("dateRegistrationsClose") &&
						form.watch("dateStart") &&
						form.watch("dateEnd") && (
							<EventTimelineDescription
								dateRegistrationsOpen={form.watch("dateRegistrationsOpen")}
								dateRegistrationsClose={form.watch("dateRegistrationsClose")}
								dateStart={form.watch("dateStart")}
								dateEnd={form.watch("dateEnd")}
							/>
						)}
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="dateStart"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Početak*</FormLabel>
									<Popover>
										<PopoverTrigger asChild={true}>
											<FormControl>
												<Button
													variant={"outline"}
													className={cn(
														"w-full pl-3 text-left font-normal",
														!field.value && "text-muted-foreground",
													)}
												>
													{field.value ? (
														format(field.value, initHourFormat.hour24, {
															locale: bs,
														})
													) : (
														<span>Odaberite datum</span>
													)}
													<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<DateTimePicker
												value={field.value}
												onChange={field.onChange}
											/>
										</PopoverContent>
									</Popover>
									<FormDescription>Kada susret počinje?</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="dateEnd"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Kraj*</FormLabel>
									<Popover>
										<PopoverTrigger asChild={true}>
											<FormControl>
												<Button
													variant={"outline"}
													className={cn(
														"w-full pl-3 text-left font-normal",
														!field.value && "text-muted-foreground",
													)}
												>
													{field.value ? (
														format(field.value, initHourFormat.hour24, {
															locale: bs,
														})
													) : (
														<span>Odaberite datum</span>
													)}
													<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<DateTimePicker
												value={field.value}
												onChange={field.onChange}
											/>
										</PopoverContent>
									</Popover>
									<FormDescription>Kada susret završava?</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="dateRegistrationsOpen"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Početak registracije</FormLabel>
									<Popover>
										<PopoverTrigger asChild={true}>
											<FormControl>
												<Button
													variant={"outline"}
													className={cn(
														"w-full pl-3 text-left font-normal",
														!field.value && "text-muted-foreground",
													)}
												>
													{field.value ? (
														format(field.value, initHourFormat.hour24, {
															locale: bs,
														})
													) : (
														<span>Odaberite datum</span>
													)}
													<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<DateTimePicker
												value={field.value}
												onChange={field.onChange}
											/>
										</PopoverContent>
									</Popover>
									<FormDescription>
										Kada se igrači mogu registrirati? Ostavite prazno da
										dozvolite registraciju odmah.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="dateRegistrationsClose"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Kraj registracije*</FormLabel>
									<Popover>
										<PopoverTrigger asChild={true}>
											<FormControl>
												<Button
													variant={"outline"}
													className={cn(
														"w-full pl-3 text-left font-normal",
														!field.value && "text-muted-foreground",
													)}
												>
													{field.value ? (
														format(field.value, initHourFormat.hour24, {
															locale: bs,
														})
													) : (
														<span>Odaberite datum</span>
													)}
													<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<DateTimePicker
												value={field.value}
												onChange={field.onChange}
											/>
										</PopoverContent>
									</Popover>
									<FormDescription>
										Kada završavaju registracije?
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div>
					<h3 className="text-lg font-semibold">Vidljivost</h3>
				</div>

				<FormField
					control={form.control}
					name="isPrivate"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<FormLabel>Privatni susret</FormLabel>
								<FormDescription>
									Susret će biti vidljiv samo vašem klubu. Korisno ako planirate
									trening.
								</FormDescription>
							</div>
							<FormControl>
								<Switch
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
							</FormControl>
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="allowFreelancers"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<FormLabel>Freelancer prijave</FormLabel>
								<FormDescription>
									Na susret se mogu prijaviti ljudi koji nisu aktivno u nekom
									klubu.
								</FormDescription>
							</div>
							<FormControl>
								<Switch
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
							</FormControl>
						</FormItem>
					)}
				/>

				<div>
					<h3 className="text-lg font-semibold">Organizacija</h3>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasBreakfast"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Doručak</FormLabel>
										<FormDescription>
											Da li će susret imati doručak?
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasLunch"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Ručak</FormLabel>
										<FormDescription>
											Da li će susret imati ručak?
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasDinner"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Večera</FormLabel>
										<FormDescription>
											Da li će susret imati večeru?
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasSnacks"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Grickalice</FormLabel>
										<FormDescription>
											Da li će susret imati grickalice?
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasDrinks"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Pića</FormLabel>
										<FormDescription>
											Da li će susret imati pića?
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasPrizes"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Nagrade</FormLabel>
										<FormDescription>
											Da li će biti nagrade za pobjednike?
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div>
					<h3 className="text-lg font-semibold">Lokacija</h3>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="location"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Lokacija*</FormLabel>
									<FormControl>
										<Input placeholder="Livno" type="text" {...field} />
									</FormControl>
									<FormDescription>Gdje se ordžava susret?</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="googleMapsLink"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Google Maps</FormLabel>
									<FormControl>
										<Textarea
											placeholder={`<iframe src="https://www.google.com/maps/embed?pb=...`}
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Možete dodati Google Maps embed link. Ta će se mapa moći
										prikazati na stranici vašeg susreta.{" "}
										<Link
											target="_blank"
											className="font-semibold flex gap-0.5 items-center"
											href={"/dashboard/help#google-maps"}
										>
											Gdje to naći? <ArrowUpRight className="size-3" />
										</Link>
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>
				<div className="flex flex-col gap-3">
					<Label>Mapa</Label>
					<MapComponent
						defaultMapData={form.watch("mapData")}
						onSaveMapData={(data) => {
							form.setValue("mapData", data);
						}}
					/>
				</div>
				<LoaderSubmitButton isLoading={isLoading}>
					{props.event ? "Ažuriraj susret" : "Kreiraj susret"}
				</LoaderSubmitButton>
			</form>
		</Form>
	);
}
