"use client";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { differenceInDays, format } from "date-fns";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type * as z from "zod";

import {
	createEvent,
	deleteEvent,
	deleteEventImage,
	getEventImageUploadUrl,
} from "@/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.action";
import { createEventFormSchema } from "@/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.schema";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DateTimePicker, initHourFormat } from "@/components/ui/date-time-picker";
import { FileInput, FileUploader, FileUploaderContent, FileUploaderItem } from "@/components/ui/file-upload";
import { Switch } from "@/components/ui/switch";
import type { ClubRule, Event } from "@prisma/client";
import { bs } from "date-fns/locale";
import {
	ArrowUpRight,
	Calendar as CalendarIcon,
	CloudUpload,
	Eye,
	Loader,
	MapPin,
	RotateCcw,
	Settings,
	Trash,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Link, useRouter } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import Image from "next/image";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { AnimatedNumber } from "@/components/animated-number";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { SlugInput } from "@/components/slug/slug-input";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const MapComponent = dynamic(() => import("@/components/map-component").then((mod) => mod.MapComponent), {
	ssr: false,
});

interface CreateEventFormProps {
	event: Event | null;
	rules: ClubRule[];
}

export default function CreateEventForm(props: CreateEventFormProps) {
	const [files, setFiles] = useState<File[] | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isDeletingImage, setIsDeletingImage] = useState(false);
	const [isSlugValid, setIsSlugValid] = useState(true);
	const confirm = useConfirm();
	const t = useTranslations("dashboard.club.events.create");

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
			parts.push(<span key="regOpen">{t("registrationsOpen")}</span>);
		} else {
			parts.push(<span key="regClose">{t("registrationsClosed")}</span>);
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
			parts.push(<span key="start">{t("eventStarted")}</span>);
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
			sessionStorage.setItem("createEventForm", JSON.stringify(value));
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
	}, [form]);

	async function onSubmit(values: z.infer<typeof createEventFormSchema>) {
		setIsLoading(true);
		try {
			const event = await createEvent(values);

			if (!event?.data || event.serverError) {
				toast.error(t("error"));
				return;
			}

			if (files?.[0]) {
				const resp = await getEventImageUploadUrl({
					file: {
						type: files[0].type,
						size: files[0].size,
					},
					eventId: event.data.id,
					clubId: clubId,
				});

				if (!resp?.data?.url) {
					toast.error(t("photoUploadError"));
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

				values.image = resp.data.cdnUrl;
				await createEvent({
					...values,
					eventId: event.data.id,
				});
			}
			router.push(`/dashboard/${clubId}/events/${event.data.id}`);

			setFiles([]);
			toast.success(t("success"));
		} catch (error) {
			toast.error(t("error"));
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
							<AlertTitle>{t("editingTitle")}</AlertTitle>
							<AlertDescription>{t("editingDescription")}</AlertDescription>
						</div>
						<div className="flex gap-1">
							<Button
								variant={"destructive"}
								type="button"
								disabled={isLoading}
								className="w-fit"
								onClick={async () => {
									const resp = await confirm({
										title: t("delete.title"),
										body: t("delete.body"),
										actionButtonVariant: "destructive",
										actionButton: t("delete.confirm"),
										cancelButton: t("delete.cancel"),
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
								{isLoading ? <Loader className="animate-spin size-4" /> : t("delete.confirm")}
							</Button>
							<Button variant="outline" asChild={true}>
								<Link
									className="flex items-center gap-1"
									href={`/dashboard/${clubId}/events/${props.event.id}`}
								>
									<Eye className="size-4" />
									{t("view")}
								</Link>
							</Button>
						</div>
					</Alert>
				)}

				{/* Basic Information Section */}
				<Card className="bg-sidebar">
					<CardHeader>
						<CardTitle className="flex items-center gap-4">
							<span>{t("general")}</span>
							<span className="text-sm font-normal text-muted-foreground">{t("requiredSection")}</span>
						</CardTitle>
						<CardDescription>{t("basicInformationDescription")}</CardDescription>
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
											{t("name")}
											<RequiredFieldMarker />
										</FormLabel>
										<FormControl>
											<Input placeholder="Food Wars 24" type="text" {...field} />
										</FormControl>
										<FormDescription>{t("nameDescription")}</FormDescription>
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
											{t("description")}
											<RequiredFieldMarker />
										</FormLabel>
										<FormControl>
											<Textarea
												placeholder={t("descriptionPlaceholder")}
												className="min-h-32"
												{...field}
											/>
										</FormControl>
										<FormDescription>{t("descriptionDescription")}</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* Optional fields */}
						<div className="pt-4 border-t space-y-4">
							<div className="flex items-center justify-between gap-2">
								<h3 className="text-base font-medium">{t("additionalInformation")}</h3>
								<span className="text-xs text-muted-foreground">{t("optional")}</span>
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
										<FormLabel>{t("photo")}</FormLabel>
										<FormControl>
											<FileUploader
												value={files}
												onValueChange={setFiles}
												dropzoneOptions={dropZoneConfig}
												className="relative bg-background p-0.5"
												key={`file-uploader-${files?.length}-${files?.[0]?.name}`}
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
																{t("fileUpload")}
															</p>
															<p className="text-xs text-gray-500 dark:text-gray-400">
																{t("fileUploadFormats")} JPG, JPEG, PNG
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
										<FormDescription>{t("photoDescription")}</FormDescription>
									</FormItem>
								)}
							/>
							{props.event?.id && props.event?.image && (
								<HoverCard openDelay={100}>
									<HoverCardTrigger>
										<Button
											type="button"
											disabled={isLoading}
											variant={"destructive"}
											onClick={async () => {
												const resp = await confirm({
													title: t("deletePhoto.title"),
													body: t("deletePhoto.body"),
													actionButtonVariant: "destructive",
													actionButton: t("deletePhoto.confirm"),
													cancelButton: t("deletePhoto.cancel"),
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
												t("deletePhoto.confirm")
											)}
										</Button>
									</HoverCardTrigger>
									<HoverCardContent className="size-full mb-8">
										<Image src={props.event.image} alt="Club logo" width={200} height={200} />
									</HoverCardContent>
								</HoverCard>
							)}

							<FormField
								control={form.control}
								name="costPerPerson"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("price")}</FormLabel>
										<FormControl>
											<Input placeholder="20" type="number" {...field} />
										</FormControl>
										<FormDescription>{t("priceDescription")}</FormDescription>
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
							<CalendarIcon className="size-5" /> {t("time")}
							<span className="text-sm font-normal text-muted-foreground">{t("requiredSection")}</span>
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
							<h3 className="text-base font-medium">{t("eventDates")}</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="dateStart"
									render={({ field }) => (
										<FormItem className="flex flex-col">
											<FormLabel>
												{t("start")}
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
																<span>{t("selectDate")}</span>
															)}
															<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<DateTimePicker value={field.value} onChange={field.onChange} />
												</PopoverContent>
											</Popover>
											<FormDescription>{t("startDescription")}</FormDescription>
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
												{t("end")}
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
																<span>{t("selectDate")}</span>
															)}
															<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<DateTimePicker value={field.value} onChange={field.onChange} />
												</PopoverContent>
											</Popover>
											<FormDescription>{t("endDescription")}</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
						</div>

						{/* Registration period section */}
						<div className="space-y-4 pt-4 border-t">
							<div className="flex items-center justify-between gap-2">
								<h3 className="text-base font-medium">{t("registrationPeriod")}</h3>
								<span className="text-xs text-muted-foreground">{t("partiallyRequired")}</span>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="dateRegistrationsOpen"
									render={({ field }) => (
										<FormItem className="flex flex-col">
											<FormLabel>{t("registrationStart")}</FormLabel>
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
																<span>{t("selectDate")}</span>
															)}
															<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<DateTimePicker value={field.value} onChange={field.onChange} />
												</PopoverContent>
											</Popover>
											<FormDescription>{t("registrationStartDescription")}</FormDescription>
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
												{t("registrationEnd")}
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
																<span>{t("selectDate")}</span>
															)}
															<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
														</Button>
													</FormControl>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<DateTimePicker value={field.value} onChange={field.onChange} />
												</PopoverContent>
											</Popover>
											<FormDescription>{t("registrationEndDescription")}</FormDescription>
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
							<MapPin className="size-5" /> {t("location")}
							<span className="text-sm font-normal text-muted-foreground">{t("requiredSection")}</span>
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
										{t("location")}
										<RequiredFieldMarker />
									</FormLabel>
									<FormControl>
										<Input placeholder="Livno" type="text" {...field} />
									</FormControl>
									<FormDescription>{t("locationDescription")}</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Non-required Google Maps field */}
						<div className="pt-4 border-t">
							<div className="flex items-center justify-between mb-4">
								<h3 className="text-base font-medium">{t("additionalLocationInfo")}</h3>
								<span className="text-xs text-muted-foreground">{t("optional")}</span>
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
											{t("googleMapsDescription")}{" "}
											<Link
												target="_blank"
												className="font-semibold flex gap-0.5 items-center"
												href={"/dashboard/help#google-maps"}
											>
												{t("googleMapsLink")} <ArrowUpRight className="size-3" />
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
								<span className="font-medium">{t("advancedSettings")}</span>
							</div>
						</AccordionTrigger>
						<AccordionContent className="pb-4 space-y-6">
							{/* Visibility Settings */}
							<div>
								<h3 className="text-base font-medium mb-4 flex items-center gap-2">
									{t("visibility")}
								</h3>
								<div className="space-y-4">
									<FormField
										control={form.control}
										name="isPrivate"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<div className="space-y-0.5">
													<FormLabel>{t("private")}</FormLabel>
													<FormDescription>{t("privateDescription")}</FormDescription>
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
													<FormLabel>{t("freelancers")}</FormLabel>
													<FormDescription>{t("freelancersDescription")}</FormDescription>
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
									{t("organization")}
								</h3>
								<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
									<FormField
										control={form.control}
										name="hasBreakfast"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<FormLabel>{t("breakfast")}</FormLabel>
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
												<FormLabel>{t("lunch")}</FormLabel>
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
												<FormLabel>{t("dinner")}</FormLabel>
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
												<FormLabel>{t("snacks")}</FormLabel>
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
												<FormLabel>{t("drinks")}</FormLabel>
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
												<FormLabel>{t("prizes")}</FormLabel>
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
								<h3 className="text-base font-medium mb-4">{t("rules")}</h3>
								<FormField
									control={form.control}
									name="ruleIds"
									render={({ field }) => {
										const [selectedRule, setSelectedRule] = useState<ClubRule | null>(null);

										return (
											<FormItem>
												<FormDescription>{t("rulesDescription")}</FormDescription>
												<FormControl>
													<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
														{/* TODO: Hot reload rules when they're added. */}
														{props.rules?.length === 0 && (
															<p className="text-muted-foreground">
																{t("noRules")}{" "}
																<Link
																	className="text-foreground"
																	href={`/dashboard/${clubId}/events/rules`}
																>
																	{t("createRule")}.
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
																				? t("changedToday")
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
																			: t("noDescription")}
																	</p>
																</SheetHeader>
																<div className="mt-6 flex-1 overflow-y-auto">
																	<div
																		className={cn(
																			"prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0",
																		)}
																		// biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
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
					{/* <AccordionItem value="map" className="border rounded-lg px-6 mt-4">
						<AccordionTrigger className="py-4">
							<div className="flex items-center gap-2">
								<MapPin className="size-5" />
								<span className="font-medium">{t("mapEditor")} (BETA)</span>
							</div>
						</AccordionTrigger>
						<AccordionContent className="pb-4">
							<div className="space-y-4">
								<p className="text-sm text-muted-foreground">
									{t("mapDescription")}
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
					</AccordionItem> */}
				</Accordion>

				<div className="flex justify-end pt-4 gap-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							sessionStorage.removeItem("createEventForm");
							form.reset(defaultFormValues);
							setFiles([]);
						}}
					>
						<RotateCcw className="size-4" />
						{t("reset")}
					</Button>
					<LoaderSubmitButton
						isLoading={isLoading}
						disabled={!isSlugValid && !!form.watch("slug")}
						className="min-w-[200px]"
					>
						{props.event ? t("save") : t("create")}
					</LoaderSubmitButton>
				</div>
			</form>
		</Form>
	);
}
