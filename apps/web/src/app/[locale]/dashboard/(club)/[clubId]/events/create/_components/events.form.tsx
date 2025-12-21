"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, differenceInDays, format, subHours } from "date-fns";
import { bs } from "date-fns/locale";
import DOMPurify from "isomorphic-dompurify";
import { ArrowUpRight, Calendar as CalendarIcon, Eye, Loader, MapPin, RotateCcw, Settings, Trash } from "lucide-react";
import { useParams } from "next/navigation";
import { useLogger } from "next-axiom";
import { useExtracted } from "next-intl";
import posthog from "posthog-js";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";
import type * as z from "zod";
import { createEventFormSchema } from "@/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.schema";
import { AnimatedNumber } from "@/components/animated-number";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { createEmptySnapshot, normalizeMapData } from "@/components/map-editor/map-data";
import { MapEditor } from "@/components/map-editor/map-editor";
import { MapViewer } from "@/components/map-editor/map-viewer";
import type { MapEditorSnapshot } from "@/components/map-editor/types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload } from "@/hooks/use-file-upload";
import { Link, useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import type { ClubRule, Event } from "@/lib/api/api-type-helpers";
import { useIsAuthenticated } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

interface CreateEventFormProps {
	event: Event | null;
	rules: ClubRule[];
	prefillDate?: Date | null;
}

type CreateEventFormValues = z.output<typeof createEventFormSchema>;

export default function CreateEventForm(props: CreateEventFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [selectedRule, setSelectedRule] = useState<ClubRule | null>(null);
	const [isSlugValid, setIsSlugValid] = useState(true);
	const confirm = useConfirm();
	const t = useExtracted();
	const logger = useLogger();
	const { user } = useIsAuthenticated();
	const eventIdRef = useRef<string | null>(props.event?.id || null);
	const normalizedMapData = useMemo(() => normalizeMapData(props.event?.mapData), [props.event?.mapData]);
	const [isMapEditorOpen, setIsMapEditorOpen] = useState(false);

	// Initialize file upload system
	const initialFiles: FileUploadItem[] = props.event?.image
		? [
				{
					id: `existing-${props.event.id}`,
					url: props.event.image,
					name: t("Event image"),
					type: "image/jpeg",
					isExisting: true,
				},
			]
		: [];

	const eventImageUpload = useFileUpload({
		uploadFunction: async (file: File) => {
			const currentEventId = eventIdRef.current;
			if (!currentEventId) {
				throw new Error(t("Save the event first."));
			}

			const { data, error } = await apiClient.POST("/api/events/{id}/image/upload-url", {
				params: {
					path: { id: currentEventId },
				},
				body: {
					file: {
						type: file.type,
						size: file.size,
					},
				},
			});

			if (error || !data?.url) {
				throw new Error(t("Could not get upload URL."));
			}

			await fetch(data.url, {
				method: "PUT",
				body: file,
				headers: {
					"Content-Type": file.type,
					"Content-Length": file.size.toString(),
				},
			});

			return data.cdnUrl;
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
					{t.rich("Registrations open for <number></number> day/s", {
						number: () => <AnimatedNumber value={days} />,
					})}
				</span>,
			);
		} else if (regCloseDiff > 0) {
			parts.push(<span key="regOpen">{t("Registrations are open")}</span>);
		} else if (regCloseDiff < 0) {
			parts.push(<span key="regClose">{t("Registrations are closed")}</span>);
		} else {
			parts.push(<span key="regClose">{t("Registrations are closed")}</span>);
		}

		if (startDiff > 0) {
			const days = Math.floor(startDiff / (1000 * 60 * 60 * 24));
			parts.push(
				<span key="start">
					{t.rich(", the event starts in <number></number> day/s", {
						number: () => <AnimatedNumber value={days} />,
					})}
				</span>,
			);
		} else {
			parts.push(<span key="start">{t(", the event has already started")}</span>);
		}

		parts.push(
			<span key="duration">
				{t.rich(", lasts <number></number> hour/s.", {
					number: () => <AnimatedNumber value={Math.round(eventDuration)} />,
				})}
			</span>,
		);

		return <p className="text-sm text-muted-foreground min-h-[50px]">{parts}</p>;
	}

	const router = useRouter();
	const clubId = useParams<{ clubId: string }>().clubId;

	const defaultStartDate = props.event?.dateStart ?? props.prefillDate ?? addDays(new Date(), 15);
	const defaultEndDate = props.event?.dateEnd ?? addDays(defaultStartDate, 1);
	const defaultRegistrationCloseDate = props.event?.dateRegistrationsClose ?? subHours(defaultStartDate, 2);

	const defaultFormValues: CreateEventFormValues = {
		eventId: props.event?.id || "",
		clubId: props.event?.clubId || clubId || "",
		name: props.event?.name || "",
		description: props.event?.description || "",
		costPerPerson: props.event?.costPerPerson || 0,
		location: props.event?.location || "",
		googleMapsLink: props.event?.googleMapsLink || "",
		dateStart: defaultStartDate ? new Date(defaultStartDate) : new Date(),
		dateEnd: defaultEndDate ? new Date(defaultEndDate) : new Date(),
		dateRegistrationsOpen: props.event?.dateRegistrationsOpen
			? new Date(props.event.dateRegistrationsOpen)
			: new Date(),
		dateRegistrationsClose: defaultRegistrationCloseDate ? new Date(defaultRegistrationCloseDate) : new Date(),
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
		mapData: normalizedMapData,
	};
	const form = useForm<CreateEventFormValues>({
		resolver: zodResolver(createEventFormSchema) as Resolver<CreateEventFormValues>,
		defaultValues: defaultFormValues,
		mode: "onChange",
	});

	const handleMapSnapshotChange = useCallback(
		(snapshot: MapEditorSnapshot) => {
			form.setValue("mapData", snapshot, { shouldDirty: true, shouldTouch: true });
		},
		[form],
	);
	const mapData = form.watch("mapData");

	useEffect(() => {
		// If editing form, ignore the saved data
		if (props.event?.id) {
			sessionStorage.removeItem("createEventForm");
			return;
		}

		if (props.prefillDate) {
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
				logger.error("Error parsing saved form data:", { error });
				sessionStorage.removeItem("createEventForm");
			}
		}
	}, [form, logger, props.event?.id, props.prefillDate]);

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

				const newEndDate = addDays(startDate, 1);
				const newRegistrationCloseDate = subHours(startDate, 2);

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
			const mapData = values.mapData ?? createEmptySnapshot();
			const normalized = normalizeMapData(mapData);

			const body = {
				name: values.name,
				description: values.description,
				costPerPerson: values.costPerPerson,
				location: values.location,
				googleMapsLink: values.googleMapsLink,
				dateStart: values.dateStart.toISOString(),
				dateEnd: values.dateEnd.toISOString(),
				dateRegistrationsOpen: values.dateRegistrationsOpen.toISOString(),
				dateRegistrationsClose: values.dateRegistrationsClose.toISOString(),
				image: values.image || undefined,
				isPrivate: values.isPrivate,
				allowFreelancers: values.allowFreelancers,
				hasBreakfast: values.hasBreakfast,
				hasLunch: values.hasLunch,
				hasDinner: values.hasDinner,
				hasSnacks: values.hasSnacks,
				hasDrinks: values.hasDrinks,
				hasPrizes: values.hasPrizes,
				slug: values.slug || undefined,
				clubId,
				ruleIds: values.ruleIds ?? [],
				mapData: normalized,
			};

			const isEditing = Boolean(props.event?.id);

			const { data: createdOrUpdated, error: createError } = isEditing
				? await apiClient.PUT("/api/events/{id}", {
						params: { path: { id: props.event?.id ?? "" } },
						body,
					})
				: await apiClient.POST("/api/events", {
						body,
					});

			if (createError || !createdOrUpdated?.event.id) {
				throw new Error(createError?.error ?? t("An error occurred while saving data"));
			}

			const eventId = createdOrUpdated.event.id;
			eventIdRef.current = eventId;

			const filesToUpload = eventImageUpload.files.filter((f) => f.file && !f.isExisting);
			if (filesToUpload.length > 0) {
				const uploadedUrls = await eventImageUpload.uploadAllFiles();
				if (uploadedUrls.length > 0) {
					const { error: updateError } = await apiClient.PUT("/api/events/{id}", {
						params: { path: { id: eventId } },
						body: {
							image: uploadedUrls[0],
							clubId,
							name: values.name,
							description: values.description,
							costPerPerson: values.costPerPerson,
							location: values.location,
							dateStart: values.dateStart.toISOString(),
							dateEnd: values.dateEnd.toISOString(),
							dateRegistrationsOpen: values.dateRegistrationsOpen.toISOString(),
							dateRegistrationsClose: values.dateRegistrationsClose.toISOString(),
						},
					});

					if (updateError) {
						throw new Error(updateError.error ?? t("An error occurred while saving data"));
					}
				}
			}

			eventImageUpload.markAsSaved();

			if (!props.event) {
				sessionStorage.removeItem("createEventForm");
			}

			// Track event creation/update
			if (user?.id) {
				posthog.capture(isEditing ? "event_updated" : "event_created", {
					user_id: user.id,
					event_id: eventId,
					club_id: clubId,
					event_name: values.name,
					has_map: Boolean(values.mapData),
					rule_count: values.ruleIds?.length || 0,
				});
			}

			router.push(`/dashboard/${clubId}/events/${eventId}`);
			toast.success(t("Successfully created event"));
		} catch (error) {
			const message = error instanceof Error ? error.message : t("An error occurred while saving data");
			toast.error(message);
		} finally {
			setIsLoading(false);
		}
	}

	const RequiredFieldMarker = () => <span className="text-destructive ml-0.5">*</span>;

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				{props.event?.id && (
					<Alert className="flex flex-col md:flex-row gap-1 justify-between -z-0">
						<div className="flex flex-col">
							<AlertTitle>{t("Change of event")}</AlertTitle>
							<AlertDescription>
								{t("This event has already been created, you are currently editing it.")}
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
										title: t("Are you sure?"),
										body: t("If you delete an event, you won't be able to get it back."),
										actionButtonVariant: "destructive",
										actionButton: t("Confirm"),
										cancelButton: t("Cancel"),
									});
									if (resp) {
										setIsLoading(true);
										try {
											const { error } = await apiClient.DELETE("/api/events/{id}", {
												params: {
													path: { id: props.event?.id ?? "" },
												},
											});

											if (error) {
												throw new Error(
													error.error ?? t("An error occurred while deleting event"),
												);
											}

											toast.success(t("Event deleted"));
											router.push(`/dashboard/${clubId}/events/`);
										} catch (error) {
											const message =
												error instanceof Error
													? error.message
													: t("An error occurred while deleting event");
											toast.error(message);
										} finally {
											setIsLoading(false);
										}
									}
								}}
							>
								<Trash className="size-4" />
								{isLoading ? <Loader className="animate-spin size-4" /> : t("Delete event")}
							</Button>
							<Button variant="outline" asChild={true}>
								<Link
									className="flex items-center gap-1"
									href={`/dashboard/${clubId}/events/${props.event.id}`}
								>
									<Eye className="size-4" />
									{t("View")}
								</Link>
							</Button>
						</div>
					</Alert>
				)}

				{/* Basic Information Section */}
				<Card className="bg-sidebar">
					<CardHeader>
						<CardTitle className="flex items-center gap-4">
							<span>{t("General")}</span>
							<span className="text-sm font-normal text-muted-foreground">{t("Required")}</span>
						</CardTitle>
						<CardDescription>{t("The basic information we need to create your event")}</CardDescription>
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
											{t("Name of the event")}
											<RequiredFieldMarker />
										</FormLabel>
										<FormControl>
											<Input placeholder={t("Food Wars 24")} type="text" {...field} />
										</FormControl>
										<FormDescription>
											{t("The name of the event will be displayed everywhere on the site")}
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
											{t("Description")}
											<RequiredFieldMarker />
										</FormLabel>
										<FormControl>
											<Textarea
												placeholder={t("Bring cutlery...")}
												className="min-h-32"
												{...field}
											/>
										</FormControl>
										<FormDescription>{t("Description of the event. ")}</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* Optional fields */}
						<div className="pt-4 border-t space-y-4">
							<div className="flex items-center justify-between gap-2">
								<h3 className="text-base font-medium">{t("Additional information")}</h3>
								<span className="text-xs text-muted-foreground">{t("Optional")}</span>
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
										<FormLabel>{t("Image")}</FormLabel>
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
										<FormDescription>{t("Add a photo of the event. ")}</FormDescription>
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="costPerPerson"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("Registration fee/price")}</FormLabel>
										<FormControl>
											<Input
												placeholder="20"
												type="number"
												{...field}
												onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
											/>
										</FormControl>
										<FormDescription>
											{t("How much does it cost to participate in the event? ")}
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
							<CalendarIcon className="size-5" /> {t("Time")}
							<span className="text-sm font-normal text-muted-foreground">{t("Required")}</span>
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
							<h3 className="text-base font-medium">{t("Event dates")}</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="dateStart"
									render={({ field }) => (
										<FormItem className="flex flex-col">
											<FormLabel>
												{t("Start")}
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
																<span>{t("Select a date")}</span>
															)}
															<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<DateTimePicker value={field.value} onChange={field.onChange} />
												</PopoverContent>
											</Popover>
											<FormDescription>{t("When does the event start?")}</FormDescription>
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
												{t("End")}
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
																<span>{t("Select a date")}</span>
															)}
															<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<DateTimePicker value={field.value} onChange={field.onChange} />
												</PopoverContent>
											</Popover>
											<FormDescription>{t("When does the event end?")}</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
						</div>

						{/* Registration period section */}
						<div className="space-y-4 pt-4 border-t">
							<div className="flex items-center justify-between gap-2">
								<h3 className="text-base font-medium">{t("Registration period")}</h3>
								<span className="text-xs text-muted-foreground">{t("Partially required")}</span>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="dateRegistrationsOpen"
									render={({ field }) => (
										<FormItem className="flex flex-col">
											<FormLabel>{t("Start of applications")}</FormLabel>
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
																<span>{t("Select a date")}</span>
															)}
															<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<DateTimePicker value={field.value} onChange={field.onChange} />
												</PopoverContent>
											</Popover>
											<FormDescription>{t("When do meetup registrations open?")}</FormDescription>
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
												{t("End of applications")}
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
																<span>{t("Select a date")}</span>
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
												{t("When do the registrations for the event close?")}
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
							<MapPin className="size-5" /> {t("Location")}
							<span className="text-sm font-normal text-muted-foreground">{t("Required")}</span>
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
										{t("Location")}
										<RequiredFieldMarker />
									</FormLabel>
									<FormControl>
										<Input placeholder="Livno" type="text" {...field} />
									</FormControl>
									<FormDescription>{t("Where is the event taking place?")}</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Non-required Google Maps field */}
						<div className="pt-4 border-t">
							<div className="flex items-center justify-between mb-4">
								<h3 className="text-base font-medium">{t("Additional location info")}</h3>
								<span className="text-xs text-muted-foreground">{t("Optional")}</span>
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
											{t("You can add a Google Maps embed link. ")}{" "}
											<Link
												target="_blank"
												className="font-semibold flex gap-0.5 items-center"
												href={"/dashboard/help#google-maps"}
											>
												{t("Where to find it?")} <ArrowUpRight className="size-3" />
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
								<span className="font-medium">{t("Advanced settings")}</span>
							</div>
						</AccordionTrigger>
						<AccordionContent className="pb-4 space-y-6">
							{/* Visibility Settings */}
							<div>
								<h3 className="text-base font-medium mb-4 flex items-center gap-2">
									{t("Visibility")}
								</h3>
								<div className="space-y-4">
									<FormField
										control={form.control}
										name="isPrivate"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<div className="space-y-0.5">
													<FormLabel>{t("Private")}</FormLabel>
													<FormDescription>
														{t("Private events are visible only to club members.")}
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
													<FormLabel>{t("Freelancers allowed")}</FormLabel>
													<FormDescription>
														{t(
															"Do you allow players who are not members of a club to register for a match?",
														)}
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
									{t("Organization")}
								</h3>
								<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
									<FormField
										control={form.control}
										name="hasBreakfast"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<FormLabel>{t("Breakfast")}</FormLabel>
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
												<FormLabel>{t("Lunch")}</FormLabel>
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
												<FormLabel>{t("Dinner")}</FormLabel>
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
												<FormLabel>{t("Snacks")}</FormLabel>
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
												<FormLabel>{t("Drinks")}</FormLabel>
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
												<FormLabel>{t("Awards")}</FormLabel>
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
								<h3 className="text-base font-medium mb-4">{t("Rules")}</h3>
								<FormField
									control={form.control}
									name="ruleIds"
									render={({ field }) => {
										return (
											<FormItem>
												<FormDescription>
													{t("Select the rules that will apply to this event.")}
												</FormDescription>
												<FormControl>
													<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
														{/* TODO: Hot reload rules when they're added. */}
														{props.rules?.length === 0 && (
															<p className="text-muted-foreground">
																{t("This club has no rules.")}{" "}
																<Link
																	className="text-foreground"
																	href={`/dashboard/${clubId}/events/rules`}
																>
																	{t("Add rules")}.
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
																				? t("Changed today")
																				: t("Changed {time} day/s ago", {
																						time: String(
																							Math.abs(
																								differenceInDays(
																									new Date(
																										rule.createdAt,
																									),
																									new Date(),
																								),
																							),
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
																			: t("No description")}
																	</p>
																</SheetHeader>
																<div className="mt-6 flex-1 overflow-y-auto px-4">
																	<div
																		className={cn(
																			"prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0",
																		)}
																		// biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized
																		dangerouslySetInnerHTML={{
																			__html: DOMPurify.sanitize(
																				selectedRule.content,
																			),
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
								<span className="font-medium">{t("Map editor")} (BETA)</span>
							</div>
						</AccordionTrigger>
						<AccordionContent className="pb-4">
							<div className="space-y-4">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
									<p className="text-sm text-muted-foreground">
										{t(
											"This is where you can edit your game map. Add points of interest, obstacles, and other important details.",
										)}
									</p>
									<div className="flex gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => {
												form.setValue("mapData", createEmptySnapshot(), {
													shouldDirty: true,
													shouldTouch: true,
												});
											}}
										>
											<RotateCcw className="size-4" />
											{t("Reset")}
										</Button>
										<Button type="button" size="sm" onClick={() => setIsMapEditorOpen(true)}>
											{t("Edit")}
										</Button>
									</div>
								</div>
								<div className="w-full h-[400px]">
									<MapViewer data={mapData} />
								</div>
							</div>
						</AccordionContent>
					</AccordionItem>
				</Accordion>

				{isMapEditorOpen ? (
					<MapEditor
						visible
						initialData={mapData}
						onSnapshotChange={handleMapSnapshotChange}
						onClose={() => setIsMapEditorOpen(false)}
					/>
				) : null}

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
						{t("Reset")}
					</Button>
					<LoaderSubmitButton
						isLoading={isLoading}
						disabled={!isSlugValid && !!form.watch("slug")}
						className="min-w-[200px]"
					>
						{props.event ? t("Save") : t("Create")}
					</LoaderSubmitButton>
				</div>
			</form>
		</Form>
	);
}
