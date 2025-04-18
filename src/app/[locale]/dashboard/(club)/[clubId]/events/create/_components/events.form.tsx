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
import { ArrowUpRight, Calendar as CalendarIcon, CloudUpload, Eye, Loader, Trash } from "lucide-react";
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

		const regOpenDiff = dateRegistrationsOpen.getTime() - now.getTime();
		const regCloseDiff = dateRegistrationsClose.getTime() - now.getTime();
		const startDiff = dateStart.getTime() - now.getTime();
		const eventDuration = (dateEnd.getTime() - dateStart.getTime()) / (1000 * 60 * 60);

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

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
				<div>
					<h3 className="text-lg font-semibold">{t("general")}</h3>
				</div>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("name")}*</FormLabel>
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
							<FormLabel>{t("description")}</FormLabel>
							<FormControl>
								<Textarea placeholder={t("descriptionPlaceholder")} className="min-h-32" {...field} />
							</FormControl>
							<FormDescription>{t("descriptionDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

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

				<div>
					<h3 className="text-lg font-semibold">{t("time")}</h3>
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
									<FormLabel>{t("start")}*</FormLabel>
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
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="dateEnd"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>{t("end")}*</FormLabel>
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

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
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
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="dateRegistrationsClose"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>{t("registrationEnd")}*</FormLabel>
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

				<div>
					<h3 className="text-lg font-semibold">{t("visibility")}</h3>
				</div>

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

				<div>
					<h3 className="text-lg font-semibold">{t("organization")}</h3>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasBreakfast"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>{t("breakfast")}</FormLabel>
									</div>
									<FormControl>
										<Switch checked={field.value} onCheckedChange={field.onChange} />
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
										<FormLabel>{t("lunch")}</FormLabel>
									</div>
									<FormControl>
										<Switch checked={field.value} onCheckedChange={field.onChange} />
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
										<FormLabel>{t("dinner")}</FormLabel>
									</div>
									<FormControl>
										<Switch checked={field.value} onCheckedChange={field.onChange} />
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
										<FormLabel>{t("snacks")}</FormLabel>
									</div>
									<FormControl>
										<Switch checked={field.value} onCheckedChange={field.onChange} />
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
										<FormLabel>{t("drinks")}</FormLabel>
									</div>
									<FormControl>
										<Switch checked={field.value} onCheckedChange={field.onChange} />
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
										<FormLabel>{t("prizes")}</FormLabel>
									</div>
									<FormControl>
										<Switch checked={field.value} onCheckedChange={field.onChange} />
									</FormControl>
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div>
					<h3 className="text-lg font-semibold">{t("location")}</h3>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="location"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("location")}*</FormLabel>
									<FormControl>
										<Input placeholder="Livno" type="text" {...field} />
									</FormControl>
									<FormDescription>{t("locationDescription")}</FormDescription>
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
				</div>
				<div>
					<h3 className="text-lg font-semibold">{t("rules")}</h3>
				</div>

				<FormField
					control={form.control}
					name="ruleIds"
					render={({ field }) => {
						const [selectedRule, setSelectedRule] = useState<ClubRule | null>(null);

						return (
							<FormItem>
								<FormLabel>{t("rules")}</FormLabel>
								<FormDescription>Odaberite pravila koja će važiti za ovaj susret.</FormDescription>
								<FormControl>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										{/* TODO: Hot reload rules when they're added. */}
										{props.rules?.length === 0 && (
											<p className="text-muted-foreground">
												{t("noRules")}{" "}
												<Link
													className="text-primary-foreground"
													href={`/dashboard/${clubId}/events/rules`}
												>
													{t("createRule")}
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
																: currentValue.filter((id) => id !== rule.id);
															field.onChange(newValue);
														}}
													/>
													<div className="grid gap-1.5">
														<Label htmlFor={rule.id}>{rule.name}</Label>
														{rule.description && (
															<p className="text-sm line-clamp-1">{rule.description}</p>
														)}
														<p className="text-sm text-muted-foreground">
															{differenceInDays(new Date(rule.createdAt), new Date()) ===
															0
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
				<div className="flex flex-col gap-3">
					<Label>{t("map")}</Label>
					<MapComponent
						defaultMapData={form.watch("mapData")}
						onSaveMapData={(data) => {
							form.setValue("mapData", data);
						}}
					/>
				</div>

				<LoaderSubmitButton isLoading={isLoading} disabled={!isSlugValid && !!form.watch("slug")}>
					{props.event ? t("save") : t("create")}
				</LoaderSubmitButton>
			</form>
		</Form>
	);
}
