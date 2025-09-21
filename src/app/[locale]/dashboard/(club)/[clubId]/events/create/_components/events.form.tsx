"use client";

import type { ClubRule, Event } from "@generated/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { differenceInDays, format } from "date-fns";
import { bs } from "date-fns/locale";
import { ArrowUpRight, Calendar as CalendarIcon, Eye, Loader, MapPin, RotateCcw, Settings, Trash } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type * as z from "zod";
import {
	createEvent,
	deleteEvent,
	getEventImageUploadUrl,
} from "@/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.action";
import { createEventFormSchema } from "@/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.schema";
import { AnimatedNumber } from "@/components/animated-number";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { SlugInput } from "@/components/slug/slug-input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker, initHourFormat } from "@/components/ui/date-time-picker";
import { FileUpload, type FileUploadItem } from "@/components/ui/file-upload";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload } from "@/hooks/use-file-upload";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Dynamically import MapComponent to avoid SSR issues
const MapComponent = dynamic(() => import("@/components/map-component").then((m) => ({ default: m.MapComponent })), {
	ssr: false,
});

interface CreateEventFormProps {
	event: Event | null;
	rules: ClubRule[];
}

export default function CreateEventForm(props: CreateEventFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [selectedRule, setSelectedRule] = useState<ClubRule | null>(null);
	const [isDeletingImage, setIsDeletingImage] = useState(false);
	const [isSlugValid, setIsSlugValid] = useState(true);
	const confirm = useConfirm();
	const t = useTranslations();

	// Initialize file upload system
	const initialFiles: FileUploadItem[] = props.event?.image
		? [
				{
					id: `existing-${props.event.id}`,
					url: props.event.image,
					name: "Event image",
					type: "image/jpeg",
					isExisting: true,
				},
			]
		: [];

	const eventImageUpload = useFileUpload({
		uploadFunction: async (file: File) => {
			if (!props.event?.id) {
				throw new Error("Must save event first");
			}

			const resp = await getEventImageUploadUrl({
				file: {
					type: file.type,
					size: file.size,
				},
				eventId: props.event.id,
				clubId: clubId,
			});

			if (!resp?.data?.url) {
				throw new Error("Failed to get upload URL");
			}

			await fetch(resp.data.url, {
				method: "PUT",
				body: file,
				headers: {
					"Content-Type": file.type,
					"Content-Length": file.size.toString(),
				},
			});

			return resp.data.cdnUrl;
		},
		maxFiles: 1,
		initialFiles,
	});

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
		if (!(dateRegistrationsOpen && dateRegistrationsClose && dateStart && dateEnd)) {
			return null;
		}

		const now = new Date();

		const regOpenDiff = dateRegistrationsOpen?.getTime() - now?.getTime();
		const regCloseDiff = dateRegistrationsClose?.getTime() - now?.getTime();
		const startDiff = dateStart?.getTime() - now?.getTime();
		const eventDuration = (dateEnd?.getTime() - dateStart?.getTime()) / (1000 * 60 * 60);

		const parts = [] as ReactNode[];

		if (regOpenDiff > 0) {
			const days = Math.floor(regOpenDiff / (1000 * 60 * 60 * 24));
			parts.push(
				<span key="regOpen">
					{t.rich("registrationsOpenIn", {
						number: () => <AnimatedNumber value={days} />,
					})}
				</span>,
			);
		} else if (regCloseDiff > 0) {
			parts.push(<span key="regOpen">{t("dashboard.club.events.create.registrationsOpen")}</span>);
		} else {
			parts.push(<span key="regClose">{t("dashboard.club.events.create.registrationsClosed")}</span>);
		}

		if (startDiff > 0) {
			const days = Math.floor(startDiff / (1000 * 60 * 60 * 24));
			parts.push(
				<span key="start">
					{t.rich("eventStartsIn", {
						number: () => <AnimatedNumber value={days} />,
					})}
				</span>,
			);
		} else {
			parts.push(<span key="start">{t("dashboard.club.events.create.eventStarted")}</span>);
		}

		parts.push(
			<span key="duration">
				{t.rich("eventDuration", {
					number: () => <AnimatedNumber value={Math.round(eventDuration)} />,
				})}
			</span>,
		);

		return <p className="text-sm text-muted-foreground min-h-[50px]">{parts}</p>;
	}

	const router = useRouter();
	const clubId = useParams<{ clubId: string }>().clubId;

	const startDate = new Date();
	startDate.setDate(startDate.getDate() + 15);

	const endDate = new Date(startDate);
	endDate.setDate(endDate.getDate() + 1);

	const registrationCloseDate = new Date(startDate);
	registrationCloseDate.setHours(registrationCloseDate.getHours() - 2);

	const defaultFormValues = {
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
		dateRegistrationsClose: props.event?.dateRegistrationsClose || registrationCloseDate,
		image: props.event?.image || "",
		isPrivate: props.event?.isPrivate,
		allowFreelancers: props.event?.allowFreelancers,
		hasBreakfast: props.event?.hasBreakfast,
		hasLunch: props.event?.hasLunch,
		hasDinner: props.event?.hasDinner,
		hasSnacks: props.event?.hasSnacks,
		slug: props.event?.slug || "",
		hasDrinks: props.event?.hasDrinks,
		hasPrizes: props.event?.hasPrizes,
		// biome-ignore lint/suspicious/noExplicitAny: I'll eventually handle this
		mapData: (props.event?.mapData as any) || { areas: [], pois: [] },
	};
	const form = useForm<z.infer<typeof createEventFormSchema>>({
		resolver: zodResolver(createEventFormSchema),
		defaultValues: defaultFormValues,
		mode: "onChange",
	});

	useEffect(() => {
		// If editing form, ignore the saved data
		if (props.event?.id) {
			sessionStorage.removeItem("createEventForm");
			return;
		}
		const savedFormData = sessionStorage.getItem("createEventForm");
		if (savedFormData) {
			try {
				const parsedData = JSON.parse(savedFormData);

				// Convert date strings back to Date objects
				if (parsedData.dateStart) parsedData.dateStart = new Date(parsedData.dateStart);
				if (parsedData.dateEnd) parsedData.dateEnd = new Date(parsedData.dateEnd);
				if (parsedData.dateRegistrationsOpen)
					parsedData.dateRegistrationsOpen = new Date(parsedData.dateRegistrationsOpen);
				if (parsedData.dateRegistrationsClose)
					parsedData.dateRegistrationsClose = new Date(parsedData.dateRegistrationsClose);

				form.reset(parsedData);
			} catch (error) {
				console.error("Error parsing saved form data:", error);
				sessionStorage.removeItem("createEventForm");
			}
		}
	}, []);

	useEffect(() => {
		const subscription = form.watch((value, { name }) => {
			if (!props.event?.id) {
				sessionStorage.setItem("createEventForm", JSON.stringify(value));
			}

			if (name === "dateStart") {
				const startDate = value.dateStart as Date;
				if (!startDate) {
					return;
				}

				const newEndDate = new Date(startDate);
				newEndDate.setDate(newEndDate.getDate() + 1);

				const newRegistrationCloseDate = new Date(startDate);
				newRegistrationCloseDate.setHours(newRegistrationCloseDate.getHours() - 2);

				form.setValue("dateEnd", newEndDate, { shouldValidate: true });
				form.setValue("dateRegistrationsClose", newRegistrationCloseDate, {
					shouldValidate: true,
				});
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	}, [form, props.event?.id]);

	async function onSubmit(values: z.infer<typeof createEventFormSchema>) {
		setIsLoading(true);
		try {
			// First create/update the event
			const event = await createEvent(values);

			if (!event?.data || event.serverError) {
				toast.error(t("dashboard.club.events.create.error"));
				return;
			}

			// Then upload any new files and handle deletion
			const uploadedUrls = await eventImageUpload.uploadAllFiles();
			if (uploadedUrls.length > 0 || eventImageUpload.files.length === 0) {
				// Update the event with the image URL (or undefined if deleted)
				await createEvent({
					...values,
					eventId: event.data.id,
					image: uploadedUrls.length > 0 ? uploadedUrls[0] : undefined,
				});
			}

			// Mark files as saved
			eventImageUpload.markAsSaved();

			if (!props.event) {
				sessionStorage.removeItem("createEventForm");
			}

			router.push(`/dashboard/${clubId}/events/${event.data.id}`);
			toast.success(t("dashboard.club.events.create.success"));
		} catch (error) {
			toast.error(t("dashboard.club.events.create.error"));
		}
		setIsLoading(false);
	}

	const RequiredFieldMarker = () => <span className="text-destructive ml-0.5">*</span>;

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				{props.event?.id && (
					<Alert className="flex flex-col md:flex-row gap-1 justify-between -z-0">
						<div className="flex flex-col">
							<AlertTitle>{t("dashboard.club.events.create.editingTitle")}</AlertTitle>
							<AlertDescription>{t("dashboard.club.events.create.editingDescription")}</AlertDescription>
						</div>
						<div className="flex gap-1">
							<Button
								variant={"destructive"}
								type="button"
								disabled={isLoading}
								className="w-fit"
								onClick={async () => {
									const resp = await confirm({
										title: t("dashboard.club.events.create.delete.title"),
										body: t("dashboard.club.events.create.delete.body"),
										actionButtonVariant: "destructive",
										actionButton: t("common.actions.confirm"),
										cancelButton: t("common.actions.cancel"),
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
									t("dashboard.club.events.create.delete.confirm")
								)}
							</Button>
							<Button variant="outline" asChild={true}>
								<Link
									className="flex items-center gap-1"
									href={`/dashboard/${clubId}/events/${props.event.id}`}
								>
									<Eye className="size-4" />
									{t("dashboard.club.events.create.view")}
								</Link>
							</Button>
						</div>
					</Alert>
				)}

				{/* Basic Information Section */}
				<Card className="bg-sidebar">
					<CardHeader>
						<CardTitle className="flex items-center gap-4">
							<span>{t("dashboard.club.events.create.general")}</span>
							<span className="text-sm font-normal text-muted-foreground">
								{t("dashboard.club.events.create.requiredSection")}
							</span>
						</CardTitle>
						<CardDescription>
							{t("dashboard.club.events.create.basicInformationDescription")}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Required fields */}
						<div className="space-y-4">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											{t("dashboard.club.events.create.name")}
											<RequiredFieldMarker />
										</FormLabel>
										<FormControl>
											<Input placeholder="Food Wars 24" type="text" {...field} />
										</FormControl>
										<FormDescription>
											{t("dashboard.club.events.create.nameDescription")}
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											{t("dashboard.club.events.create.description")}
											<RequiredFieldMarker />
										</FormLabel>
										<FormControl>
											<Textarea
												placeholder={t("dashboard.club.events.create.descriptionPlaceholder")}
												className="min-h-32"
												{...field}
											/>
										</FormControl>
										<FormDescription>
											{t("dashboard.club.events.create.descriptionDescription")}
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* Optional fields */}
						<div className="pt-4 border-t space-y-4">
							<div className="flex items-center justify-between gap-2">
								<h3 className="text-base font-medium">
									{t("dashboard.club.events.create.additionalInformation")}
								</h3>
								<span className="text-xs text-muted-foreground">
									{t("dashboard.club.events.create.optional")}
								</span>
							</div>

							<FormField
								control={form.control}
								name="slug"
								render={({ field }) => (
									<SlugInput
										currentSlug={props.event?.slug}
										defaultSlug={field.value}
										type="event"
										onValid={(slug) => {
											form.setValue("slug", slug);
											setIsSlugValid(true);
										}}
										onValidityChange={setIsSlugValid}
									/>
								)}
							/>

							<FormField
								control={form.control}
								name="image"
								render={() => (
									<FormItem>
										<FormLabel>{t("dashboard.club.events.create.photo")}</FormLabel>
										<FormControl>
											<FileUpload
												value={eventImageUpload.files}
												onChange={eventImageUpload.setFiles}
												maxFiles={1}
												maxFileSize={4 * 1024 * 1024}
												accept={{
													"image/jpeg": [".jpg", ".jpeg"],
													"image/png": [".png"],
													"image/webp": [".webp"],
												}}
												multiple={false}
												showPreview={true}
											/>
										</FormControl>
										<FormDescription>
											{t("dashboard.club.events.create.photoDescription")}
										</FormDescription>
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="costPerPerson"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("dashboard.club.events.create.price")}</FormLabel>
										<FormControl>
											<Input
												placeholder="20"
												type="number"
												{...field}
												onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
											/>
										</FormControl>
										<FormDescription>
											{t("dashboard.club.events.create.priceDescription")}
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Timing Section */}
				<Card className="bg-sidebar">
					<CardHeader>
						<CardTitle className="flex items-center gap-4">
							<CalendarIcon className="size-5" /> {t("dashboard.club.events.create.time")}
							<span className="text-sm font-normal text-muted-foreground">
								{t("dashboard.club.events.create.requiredSection")}
							</span>
						</CardTitle>
						<CardDescription>
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
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Required event dates section */}
						<div className="space-y-4">
							<h3 className="text-base font-medium">{t("dashboard.club.events.create.eventDates")}</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="dateStart"
									render={({ field }) => (
										<FormItem className="flex flex-col">
											<FormLabel>
												{t("dashboard.club.events.create.start")}
												<RequiredFieldMarker />
											</FormLabel>
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
																<span>
																	{t("dashboard.club.events.create.selectDate")}
																</span>
															)}
															<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<DateTimePicker value={field.value} onChange={field.onChange} />
												</PopoverContent>
											</Popover>
											<FormDescription>
												{t("dashboard.club.events.create.startDescription")}
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="dateEnd"
									render={({ field }) => (
										<FormItem className="flex flex-col">
											<FormLabel>
												{t("dashboard.club.events.create.end")}
												<RequiredFieldMarker />
											</FormLabel>
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
																<span>
																	{t("dashboard.club.events.create.selectDate")}
																</span>
															)}
															<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<DateTimePicker value={field.value} onChange={field.onChange} />
												</PopoverContent>
											</Popover>
											<FormDescription>
												{t("dashboard.club.events.create.endDescription")}
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
						</div>

						{/* Registration period section */}
						<div className="space-y-4 pt-4 border-t">
							<div className="flex items-center justify-between gap-2">
								<h3 className="text-base font-medium">
									{t("dashboard.club.events.create.registrationPeriod")}
								</h3>
								<span className="text-xs text-muted-foreground">
									{t("dashboard.club.events.create.partiallyRequired")}
								</span>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="dateRegistrationsOpen"
									render={({ field }) => (
										<FormItem className="flex flex-col">
											<FormLabel>{t("dashboard.club.events.create.registrationStart")}</FormLabel>
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
																<span>
																	{t("dashboard.club.events.create.selectDate")}
																</span>
															)}
															<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<DateTimePicker value={field.value} onChange={field.onChange} />
												</PopoverContent>
											</Popover>
											<FormDescription>
												{t("dashboard.club.events.create.registrationStartDescription")}
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="dateRegistrationsClose"
									render={({ field }) => (
										<FormItem className="flex flex-col">
											<FormLabel>
												{t("dashboard.club.events.create.registrationEnd")}
												<RequiredFieldMarker />
											</FormLabel>
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
																<span>
																	{t("dashboard.club.events.create.selectDate")}
																</span>
															)}
															<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<DateTimePicker value={field.value} onChange={field.onChange} />
												</PopoverContent>
											</Popover>
											<FormDescription>
												{t("dashboard.club.events.create.registrationEndDescription")}
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Location Section */}
				<Card className="bg-sidebar">
					<CardHeader>
						<CardTitle className="flex items-center gap-4">
							<MapPin className="size-5" /> {t("dashboard.club.events.create.location")}
							<span className="text-sm font-normal text-muted-foreground">
								{t("dashboard.club.events.create.requiredSection")}
							</span>
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Required location field */}
						<FormField
							control={form.control}
							name="location"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t("dashboard.club.events.create.location")}
										<RequiredFieldMarker />
									</FormLabel>
									<FormControl>
										<Input placeholder="Livno" type="text" {...field} />
									</FormControl>
									<FormDescription>
										{t("dashboard.club.events.create.locationDescription")}
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Non-required Google Maps field */}
						<div className="pt-4 border-t">
							<div className="flex items-center justify-between mb-4">
								<h3 className="text-base font-medium">
									{t("dashboard.club.events.create.additionalLocationInfo")}
								</h3>
								<span className="text-xs text-muted-foreground">
									{t("dashboard.club.events.create.optional")}
								</span>
							</div>
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
											{t("dashboard.club.events.create.googleMapsDescription")}{" "}
											<Link
												target="_blank"
												className="font-semibold flex gap-0.5 items-center"
												href={"/dashboard/help#google-maps"}
											>
												{t("dashboard.club.events.create.googleMapsLink")}{" "}
												<ArrowUpRight className="size-3" />
											</Link>
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</CardContent>
				</Card>

				{/* Advanced Settings */}
				<Accordion type="single" collapsible className="w-full">
					<AccordionItem value="settings" className="border rounded-lg px-6">
						<AccordionTrigger className="py-4">
							<div className="flex items-center gap-2">
								<Settings className="size-5" />
								<span className="font-medium">
									{t("dashboard.club.events.create.advancedSettings")}
								</span>
							</div>
						</AccordionTrigger>
						<AccordionContent className="pb-4 space-y-6">
							{/* Visibility Settings */}
							<div>
								<h3 className="text-base font-medium mb-4 flex items-center gap-2">
									{t("dashboard.club.events.create.visibility")}
								</h3>
								<div className="space-y-4">
									<FormField
										control={form.control}
										name="isPrivate"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<div className="space-y-0.5">
													<FormLabel>{t("dashboard.club.events.create.private")}</FormLabel>
													<FormDescription>
														{t("dashboard.club.events.create.privateDescription")}
													</FormDescription>
												</div>
												<FormControl>
													<Switch checked={field.value} onCheckedChange={field.onChange} />
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
													<FormLabel>
														{t("dashboard.club.events.create.freelancers")}
													</FormLabel>
													<FormDescription>
														{t("dashboard.club.events.create.freelancersDescription")}
													</FormDescription>
												</div>
												<FormControl>
													<Switch checked={field.value} onCheckedChange={field.onChange} />
												</FormControl>
											</FormItem>
										)}
									/>
								</div>
							</div>

							{/* Amenities Settings */}
							<div>
								<h3 className="text-base font-medium mb-4 flex items-center gap-2">
									{t("dashboard.club.events.create.organization")}
								</h3>
								<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
									<FormField
										control={form.control}
										name="hasBreakfast"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<FormLabel>{t("dashboard.club.events.create.breakfast")}</FormLabel>
												<FormControl>
													<Switch checked={field.value} onCheckedChange={field.onChange} />
												</FormControl>
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="hasLunch"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<FormLabel>{t("dashboard.club.events.create.lunch")}</FormLabel>
												<FormControl>
													<Switch checked={field.value} onCheckedChange={field.onChange} />
												</FormControl>
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="hasDinner"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<FormLabel>{t("dashboard.club.events.create.dinner")}</FormLabel>
												<FormControl>
													<Switch checked={field.value} onCheckedChange={field.onChange} />
												</FormControl>
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="hasSnacks"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<FormLabel>{t("dashboard.club.events.create.snacks")}</FormLabel>
												<FormControl>
													<Switch checked={field.value} onCheckedChange={field.onChange} />
												</FormControl>
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="hasDrinks"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<FormLabel>{t("dashboard.club.events.create.drinks")}</FormLabel>
												<FormControl>
													<Switch checked={field.value} onCheckedChange={field.onChange} />
												</FormControl>
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="hasPrizes"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<FormLabel>{t("dashboard.club.events.create.prizes")}</FormLabel>
												<FormControl>
													<Switch checked={field.value} onCheckedChange={field.onChange} />
												</FormControl>
											</FormItem>
										)}
									/>
								</div>
							</div>

							{/* Rules Section */}
							<div>
								<h3 className="text-base font-medium mb-4">
									{t("dashboard.club.events.create.rules")}
								</h3>
								<FormField
									control={form.control}
									name="ruleIds"
									render={({ field }) => {
										return (
											<FormItem>
												<FormDescription>
													{t("dashboard.club.events.create.rulesDescription")}
												</FormDescription>
												<FormControl>
													<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
														{/* TODO: Hot reload rules when they're added. */}
														{props.rules?.length === 0 && (
															<p className="text-muted-foreground">
																{t("dashboard.club.events.create.noRules")}{" "}
																<Link
																	className="text-foreground"
																	href={`/dashboard/${clubId}/events/rules`}
																>
																	{t("dashboard.club.events.create.createRule")}.
																</Link>
															</p>
														)}
														{props.rules?.map((rule) => (
															<div
																key={rule.id}
																className="flex items-center justify-between space-x-2 p-4 border rounded-lg"
															>
																<div className="flex items-center gap-4">
																	<Checkbox
																		checked={(field.value || []).includes(rule.id)}
																		onCheckedChange={(checked) => {
																			const currentValue = field.value || [];
																			const newValue = checked
																				? [...currentValue, rule.id]
																				: currentValue.filter(
																						(id) => id !== rule.id,
																					);
																			field.onChange(newValue);
																		}}
																	/>
																	<div className="grid gap-1.5">
																		<Label htmlFor={rule.id}>{rule.name}</Label>
																		{rule.description && (
																			<p className="text-sm line-clamp-1">
																				{rule.description}
																			</p>
																		)}
																		<p className="text-sm text-muted-foreground">
																			{differenceInDays(
																				new Date(rule.createdAt),
																				new Date(),
																			) === 0
																				? t(
																						"dashboard.club.events.create.changedToday",
																					)
																				: t("changedAgo", {
																						time: differenceInDays(
																							new Date(rule.createdAt),
																							new Date(),
																						),
																					})}
																		</p>
																	</div>
																</div>
																<Button
																	type="button"
																	variant="ghost"
																	size="icon"
																	onClick={() => setSelectedRule(rule)}
																>
																	<Eye className="h-4 w-4" />
																</Button>
															</div>
														))}
													</div>
												</FormControl>
												<FormMessage />

												<Sheet open={!!selectedRule} onOpenChange={() => setSelectedRule(null)}>
													<SheetContent
														side="right"
														className="w-screen sm:w-[45vw] overflow-y-auto flex flex-col"
													>
														{selectedRule && (
															<>
																<SheetHeader>
																	<SheetTitle>{selectedRule.name}</SheetTitle>
																	<p className="text-muted-foreground">
																		{(selectedRule.description?.length ?? 0) > 0
																			? selectedRule.description
																			: t(
																					"dashboard.club.events.create.noDescription",
																				)}
																	</p>
																</SheetHeader>
																<div className="mt-6 flex-1 overflow-y-auto">
																	<div
																		className={cn(
																			"prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0",
																		)}
																		dangerouslySetInnerHTML={{
																			__html: selectedRule.content,
																		}}
																	/>
																</div>
															</>
														)}
													</SheetContent>
												</Sheet>
											</FormItem>
										);
									}}
								/>
							</div>
						</AccordionContent>
					</AccordionItem>

					{/* Map Section */}
					<AccordionItem value="map" className="border rounded-lg px-6 mt-4">
						<AccordionTrigger className="py-4">
							<div className="flex items-center gap-2">
								<MapPin className="size-5" />
								<span className="font-medium">
									{t("dashboard.club.events.create.mapEditor")} (BETA)
								</span>
							</div>
						</AccordionTrigger>
						<AccordionContent className="pb-4">
							<div className="space-y-4">
								<p className="text-sm text-muted-foreground">
									{t("dashboard.club.events.create.mapDescription")}
								</p>
								<div className="w-full h-[400px] border rounded-lg overflow-hidden">
									<MapComponent
										defaultMapData={form.watch("mapData")}
										onSaveMapData={(data) => {
											form.setValue("mapData", data);
										}}
									/>
								</div>
							</div>
						</AccordionContent>
					</AccordionItem>
				</Accordion>

				<div className="flex justify-end pt-4 gap-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							if (!props.event?.id) {
								sessionStorage.removeItem("createEventForm");
							}
							form.reset(defaultFormValues);
							eventImageUpload.resetToInitial();
						}}
					>
						<RotateCcw className="size-4" />
						{t("common.actions.reset")}
					</Button>
					<LoaderSubmitButton
						isLoading={isLoading}
						disabled={!isSlugValid && !!form.watch("slug")}
						className="min-w-[200px]"
					>
						{props.event
							? t("common.actions.save")
							: t("common.actions.create")}
					</LoaderSubmitButton>
				</div>
			</form>
		</Form>
	);
}
