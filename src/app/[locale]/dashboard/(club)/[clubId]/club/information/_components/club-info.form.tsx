"use client";
import type { Club } from "@generated/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { SiInstagram } from "@icons-pack/react-simple-icons";
import { format } from "date-fns";
import {
	AlertCircle,
	ArrowUpRight,
	Calendar as CalendarIcon,
	Check,
	CheckCircle,
	ChevronsUpDown,
	Loader,
	Trash,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
	deleteClub,
	disconnectInstagramAccount,
	getClubImageUploadUrl,
	saveClubInformation,
} from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.action";
import { clubInfoSchema } from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.schema";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { SlugInput } from "@/components/slug/slug-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { FileUpload, type FileUploadItem } from "@/components/ui/file-upload";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useHash } from "@/hooks/use-hash";
import { Link, useRouter } from "@/i18n/navigation";
import type { Country } from "@/lib/cached-countries";
import { cn } from "@/lib/utils";

// Dynamically import map to avoid SSR issues
const MapSelector = dynamic(() => import("@/components/clubs-map/clubs-map").then((m) => m.ClubsMap), {
	ssr: false,
});

interface ClubInfoFormProps {
	club?: Club | null;
	isClubOwner?: boolean;
	countries: Country[];
	instagramConnectionUrl?: string;
}

export function ClubInfoForm(props: ClubInfoFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [isSlugValid, setIsSlugValid] = useState(true);
	const [open, setOpen] = useState(false);
	const [instagramSuccess, setInstagramSuccess] = useState(false);
	const [instagramError, setInstagramError] = useState<string | null>(null);
	const [instagramErrorMessage, setInstagramErrorMessage] = useState<string | null>(null);
	const [isDisconnectingInstagram, setIsDisconnectingInstagram] = useState(false);
	const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);
	const [mapZoom, setMapZoom] = useState<number>(8);
	const confirm = useConfirm();
	const t = useTranslations();
	const clubIdRef = useRef<string | null>(props.club?.id || null);
	const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const geocodeAbortRef = useRef<AbortController | null>(null);

	// Initialize file upload system for logo
	const initialFiles: FileUploadItem[] = props.club?.logo
		? [
				{
					id: `existing-${props.club.id}`,
					url: props.club.logo,
					name: "Club logo",
					type: "image/jpeg",
					isExisting: true,
				},
			]
		: [];

	const logoUpload = useFileUpload({
		uploadFunction: async (file: File) => {
			const currentClubId = clubIdRef.current;
			if (!currentClubId) {
				throw new Error("Must save club first");
			}

			const resp = await getClubImageUploadUrl({
				file: {
					type: file.type,
					size: file.size,
				},
				clubId: currentClubId,
			});

			if (!resp?.data?.url) {
				throw new Error("Failed to get upload URL");
			}

			await fetch(resp.data?.url, {
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

	const router = useRouter();
	const searchParams = useSearchParams();

	// Add hash navigation support
	useHash();

	// Check for Instagram connection messages
	const instagramSuccessParam = searchParams.get("instagramSuccess");
	const instagramErrorParam = searchParams.get("instagramError");
	const errorMessageParam = searchParams.get("errorMessage");

	useEffect(() => {
		if (instagramSuccessParam) {
			setInstagramSuccess(true);
		}

		if (instagramErrorParam) {
			setInstagramError(instagramErrorParam);
		}

		if (errorMessageParam) {
			setInstagramErrorMessage(errorMessageParam);
		}

		// Delete the URL parameters after setting the state
		const newUrl = new URL(window.location.href);
		newUrl.searchParams.delete("instagramSuccess");
		newUrl.searchParams.delete("instagramError");
		newUrl.searchParams.delete("errorMessage");
		window.history.replaceState({}, document.title, newUrl.toString());
	}, [instagramSuccessParam, instagramErrorParam, errorMessageParam]);

	const form = useForm<z.infer<typeof clubInfoSchema>>({
		resolver: zodResolver(clubInfoSchema),
		defaultValues: {
			clubId: props.club?.id || "",
			name: props.club?.name || "",
			location: props.club?.location || "",
			description: props.club?.description || "",
			dateFounded: props.club?.dateFounded || new Date(),
			isAllied: props.club?.isAllied,
			isPrivate: props.club?.isPrivate,
			isPrivateStats: props.club?.isPrivateStats,
			logo: props.club?.logo || undefined,
			contactPhone: props.club?.contactPhone || undefined,
			contactEmail: props.club?.contactEmail || undefined,
			slug: props.club?.slug || undefined,
			latitude: props.club?.latitude || undefined,
			longitude: props.club?.longitude || undefined,
			countryId: props.club?.countryId || undefined,
			website: props.club?.website || undefined,
		},
		mode: "onBlur",
	});

	const selectedCountryId = form.watch("countryId");
	const locationValue = form.watch("location");
	const latitudeValue = form.watch("latitude");
	const longitudeValue = form.watch("longitude");
	const nameValue = form.watch("name");
	const descriptionValue = form.watch("description");
	const slugValue = form.watch("slug");

	// Add this handler for map location selection
	const handleLocationSelect = (lat: number, lng: number) => {
		form.setValue("latitude", lat, { shouldDirty: true });
		form.setValue("longitude", lng, { shouldDirty: true });
		setMapCenter([lat, lng]);
		setMapZoom(14);
	};

	const handleLocationReset = () => {
		if (props.club) {
			form.setValue("latitude", props.club.latitude ?? undefined, { shouldDirty: true });
			form.setValue("longitude", props.club.longitude ?? undefined, { shouldDirty: true });
			if (props.club.latitude && props.club.longitude) {
				setMapCenter([props.club.latitude, props.club.longitude]);
				setMapZoom(14);
				return;
			}
		}

		const selectedCountry = props.countries.find((country) => country.id === selectedCountryId);
		if (selectedCountry?.latitude && selectedCountry?.longitude) {
			setMapCenter([selectedCountry.latitude, selectedCountry.longitude]);
			setMapZoom(6);
		}
	};

	// Add this function to handle Instagram disconnection
	const handleDisconnectInstagram = async () => {
		if (!props.club?.id) {
			return;
		}

		const confirmed = await confirm({
			title: t("dashboard.club.info.instagramDisconnect.title"),
			body: t("dashboard.club.info.instagramDisconnect.body"),
			actionButtonVariant: "destructive",
			actionButton: t("common.actions.confirm"),
			cancelButton: t("common.actions.cancel"),
		});

		if (!confirmed) {
			return;
		}

		setIsDisconnectingInstagram(true);
		try {
			const result = await disconnectInstagramAccount({
				clubId: props.club.id,
			});

			if (!result?.data?.success) {
				throw new Error(result?.serverError);
			}

			toast.success(t("dashboard.club.info.instagramDisconnectSuccess"));
			router.refresh();
		} catch (_) {
			toast.error(t("dashboard.club.info.instagramDisconnectError"));
		} finally {
			setIsDisconnectingInstagram(false);
		}
	};

	// Handle country selection - center map on country
	useEffect(() => {
		if (typeof latitudeValue === "number" && typeof longitudeValue === "number") {
			return;
		}
		if (selectedCountryId) {
			const selectedCountry = props.countries.find((c) => c.id === selectedCountryId);
			if (selectedCountry?.latitude && selectedCountry?.longitude) {
				setMapCenter([selectedCountry.latitude, selectedCountry.longitude]);
				setMapZoom(6);
			}
		}
	}, [selectedCountryId, props.countries, latitudeValue, longitudeValue]);

	// Keep map centered on precise coordinates when available
	useEffect(() => {
		if (typeof latitudeValue === "number" && typeof longitudeValue === "number") {
			setMapCenter([latitudeValue, longitudeValue]);
			setMapZoom(14);
		}
	}, [latitudeValue, longitudeValue]);

	// Handle location/city geocoding
	useEffect(() => {
		if (geocodeTimeoutRef.current) {
			clearTimeout(geocodeTimeoutRef.current);
		}

		if (geocodeAbortRef.current) {
			geocodeAbortRef.current.abort();
		}

		if (!locationValue || locationValue.length < 3 || !selectedCountryId) {
			return;
		}

		const selectedCountry = props.countries.find((c) => c.id === selectedCountryId);
		if (!selectedCountry) {
			return;
		}

		geocodeTimeoutRef.current = setTimeout(async () => {
			try {
				geocodeAbortRef.current = new AbortController();
				const query = encodeURIComponent(`${locationValue}, ${selectedCountry.name}`);
				const response = await fetch(
					`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
					{
						signal: geocodeAbortRef.current.signal,
						headers: {
							"User-Agent": "AirsoftClubManagement/1.0",
						},
					},
				);
				const data = await response.json();

				if (data && data.length > 0) {
					const result = data[0];
					const lat = Number.parseFloat(result.lat);
					const lng = Number.parseFloat(result.lon);

					if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
						form.setValue("latitude", lat, { shouldDirty: true });
						form.setValue("longitude", lng, { shouldDirty: true });
						setMapCenter([lat, lng]);
						setMapZoom(12);
					}
				}
			} catch (error) {
				if (error instanceof Error && error.name !== "AbortError") {
					console.error("Geocoding error:", error);
				}
			}
		}, 1000);

		return () => {
			if (geocodeTimeoutRef.current) {
				clearTimeout(geocodeTimeoutRef.current);
			}
			if (geocodeAbortRef.current) {
				geocodeAbortRef.current.abort();
			}
		};
	}, [locationValue, selectedCountryId, props.countries, form]);

	// Helper function to get error message translation key
	const getInstagramErrorTranslationKey = (errorCode: string): string => {
		switch (errorCode) {
			case "no_facebook_pages":
				return "dashboard.club.info.instagramError.noFacebookPages";
			case "no_instagram_business_account":
				return "dashboard.club.info.instagramError.noInstagramAccount";
			case "not_connected_to_instagram":
				return "dashboard.club.info.instagramError.notConnected";
			case "missing_params":
				return "dashboard.club.info.instagramError.missingParams";
			case "auth_failed":
				return "dashboard.club.info.instagramError.authFailed";
			case "page_not_found":
				return "dashboard.club.info.instagramError.pageNotFound";
			case "personal_account":
				return "dashboard.club.info.instagramError.personalAccount";
			default:
				return "dashboard.club.info.instagramError.connectionFailed";
		}
	};

	async function onSubmit(values: z.infer<typeof clubInfoSchema>) {
		setIsLoading(true);
		try {
			const isCreating = !props.club?.id;
			let clubId = props.club?.id;

			if (isCreating) {
				values.logo = undefined;
				const result = await saveClubInformation(values);

				if (!result?.data?.id) {
					throw new Error("Failed to create club");
				}

				clubId = result.data.id;
				clubIdRef.current = clubId;
			}

			const filesToUpload = logoUpload.files.filter((f) => f.file && !f.isExisting);
			if (filesToUpload.length > 0 && clubId) {
				const uploadedUrls = await logoUpload.uploadAllFiles();
				const logoUrl = uploadedUrls[0];
				if (logoUrl) {
					values.logo = logoUrl;
				}
			} else {
				const existingUrls = logoUpload.files
					.filter((f) => f.isExisting && f.url)
					.map((f) => f.url)
					.filter((url): url is string => url !== undefined);
				values.logo = existingUrls.length > 0 ? existingUrls[0] : undefined;
			}

			if (!isCreating || filesToUpload.length > 0) {
				await saveClubInformation(values);
			}

			logoUpload.markAsSaved();
			toast.success(t("dashboard.club.info.success"));

			if (isCreating && clubId) {
				router.push(`/dashboard/${clubId}/club`);
			}
		} catch {
			toast.error(t("dashboard.club.info.error"));
		}
		setIsLoading(false);
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-3xl">
				{props.club && (
					<Alert className="flex flex-col md:flex-row gap-1 justify-between -z-0">
						<div className="flex flex-col">
							<AlertTitle>{t("dashboard.club.info.clubEditTitle")}</AlertTitle>
							<AlertDescription>{t("dashboard.club.info.clubEditDescription")}</AlertDescription>
						</div>
						<div className="flex gap-1">
							{props.isClubOwner && (
								<Button
									variant={"destructive"}
									type="button"
									disabled={isLoading}
									className="w-fit"
									onClick={async () => {
										const resp = await confirm({
											title: t("dashboard.club.info.clubDelete.title"),
											body: t("dashboard.club.info.clubDelete.body"),
											actionButtonVariant: "destructive",
											actionButton: t("dashboard.club.info.clubDelete.confirm"),
											cancelButton: t("dashboard.club.info.clubDelete.cancel"),
										});
										if (resp) {
											setIsLoading(true);
											await deleteClub({
												clubId: props.club?.id ?? "",
											});
											setIsLoading(false);
										}
									}}
								>
									<Trash className="size-4" />

									{isLoading ? (
										<Loader className="animate-spin size-4" />
									) : (
										t("dashboard.club.info.clubDelete.confirm")
									)}
								</Button>
							)}
						</div>
					</Alert>
				)}
				<div>
					<h3 className="text-lg font-semibold">{t("dashboard.club.info.general")}</h3>
				</div>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								{t("dashboard.club.info.name")}* ({nameValue?.length ?? 0}/
								{clubInfoSchema.shape.name.maxLength})
							</FormLabel>
							<FormControl>
								<Input placeholder="Veis" type="text" {...field} />
							</FormControl>
							<FormDescription>{t("dashboard.club.info.nameDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="countryId"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>{t("dashboard.club.info.country")}*</FormLabel>
							<Popover open={open} onOpenChange={setOpen}>
								<PopoverTrigger asChild>
									<FormControl>
										<Button
											variant="outline"
											aria-expanded={open}
											className={cn(
												"w-full justify-between",
												!field.value && "text-muted-foreground",
											)}
										>
											{field.value
												? props.countries.find((country) => country.id === field.value)?.name
												: t("dashboard.club.info.pickCountry")}
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</FormControl>
								</PopoverTrigger>
								<PopoverContent className="w-full p-0">
									<Command>
										<CommandInput placeholder={t("dashboard.club.info.searchCountry")} />
										<CommandEmpty>{t("dashboard.club.info.noResults")}</CommandEmpty>
										<CommandGroup className="h-[300px] overflow-y-scroll">
											{props.countries.map((country) => (
												<CommandItem
													key={country.id}
													value={country.name}
													onSelect={() => {
														form.setValue("countryId", country.id, { shouldDirty: true });
														setOpen(false);
													}}
												>
													<Check
														className={cn(
															"mr-2 h-4 w-4",
															country.id === field.value ? "opacity-100" : "opacity-0",
														)}
													/>
													{country.emoji} {country.name}
												</CommandItem>
											))}
										</CommandGroup>
									</Command>
								</PopoverContent>
							</Popover>
							<FormDescription>{t("dashboard.club.info.countryDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="location"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("dashboard.club.info.city")}*</FormLabel>
							<FormControl>
								<Input placeholder="Livno" type="text" {...field} />
							</FormControl>
							<FormDescription>{t("dashboard.club.info.cityDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormItem>
					<FormLabel className="flex items-center justify-between">
						<span>{t("dashboard.club.info.exactLocation")}</span>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={handleLocationReset}
							data-hidden={
								latitudeValue === props.club?.latitude && longitudeValue === props.club?.longitude
							}
							className="h-6 px-2 text-xs data-[hidden=true]:opacity-0"
						>
							{t("dashboard.club.info.reset")}
						</Button>
					</FormLabel>
					<FormDescription>{t("dashboard.club.info.mapClickToMark")}</FormDescription>
					<FormControl>
						<div className="h-[400px] w-full rounded-lg overflow-hidden border">
							<MapSelector
								clubs={[
									{
										id: props.club?.id ?? "new",
										name: nameValue || "",
										latitude: latitudeValue || null,
										longitude: longitudeValue || null,
										location: locationValue,
										logo: props.club?.logo,
									},
								]}
								interactive={true}
								onLocationSelect={handleLocationSelect}
								focusPoint={
									mapCenter ? { lat: mapCenter[0], lng: mapCenter[1], zoom: mapZoom } : undefined
								}
							/>
						</div>
					</FormControl>
					<FormDescription>
						{t.rich("dashboard.club.info.exactLocationDescription", {
							link: () => (
								<Link target="_blank" className="text-red-500" href="/map">
									{t("dashboard.club.info.exactLocationLink")}
									<ArrowUpRight className="inline-block h-4 w-4 ml-1" />
								</Link>
							),
						})}
					</FormDescription>
				</FormItem>

				<FormField
					control={form.control}
					name="slug"
					render={({ field }) => (
						<SlugInput
							currentSlug={props.club?.slug}
							defaultSlug={field.value}
							type="club"
							onValid={(slug) => {
								form.setValue("slug", slug, { shouldDirty: true });
								setIsSlugValid(true);
							}}
							onValidityChange={setIsSlugValid}
						/>
					)}
				/>

				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								{t("dashboard.club.info.description")}* ({descriptionValue?.length ?? 0}/
								{clubInfoSchema.shape.description.maxLength})
							</FormLabel>
							<FormControl>
								<Textarea
									placeholder={t("dashboard.club.info.descriptionPlaceholder")}
									className="resize-none"
									{...field}
								/>
							</FormControl>
							<FormDescription>{t("dashboard.club.info.descriptionDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="dateFounded"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>{t("dashboard.club.info.foundedDate")}*</FormLabel>
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
												format(field.value, "PPP")
											) : (
												<span>{t("dashboard.club.info.chooseDate")}</span>
											)}
											<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
										</Button>
									</FormControl>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="start">
									<DateTimePicker value={field.value} onChange={field.onChange} granularity="day" />
								</PopoverContent>
							</Popover>
							<FormDescription>{t("dashboard.club.info.foundedDateDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="isAllied"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<FormLabel>{t("dashboard.club.info.isAllied")}</FormLabel>
								<FormDescription>{t("dashboard.club.info.isAlliedDescription")}</FormDescription>
							</div>
							<FormControl>
								<Switch checked={field.value} onCheckedChange={field.onChange} />
							</FormControl>
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="isPrivate"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<FormLabel>{t("dashboard.club.info.private")}</FormLabel>
								<FormDescription>{t("dashboard.club.info.privateDescription")}</FormDescription>
							</div>
							<FormControl>
								<Switch checked={field.value} onCheckedChange={field.onChange} />
							</FormControl>
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="isPrivateStats"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<FormLabel>{t("dashboard.club.info.privateStats")}</FormLabel>
								<FormDescription>{t("dashboard.club.info.privateStatsDescription")}</FormDescription>
							</div>
							<FormControl>
								<Switch checked={field.value} onCheckedChange={field.onChange} />
							</FormControl>
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="logo"
					render={() => (
						<FormItem>
							<FormLabel>{t("dashboard.club.info.logo")}</FormLabel>
							<FormControl>
								<FileUpload
									value={logoUpload.files}
									onChange={logoUpload.setFiles}
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
							<FormDescription>{t("dashboard.club.info.logoDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div>
					<h3 className="text-lg font-semibold">{t("dashboard.club.info.contact")}</h3>
				</div>

				<FormField
					control={form.control}
					name="contactPhone"
					render={({ field }) => (
						<FormItem className="flex flex-col items-start">
							<FormLabel>{t("dashboard.club.info.phone")}</FormLabel>
							<FormControl className="w-full">
								<PhoneInput placeholder="063 000 000" {...field} defaultCountry="BA" />
							</FormControl>
							<FormDescription>{t("dashboard.club.info.phoneDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="contactEmail"
					render={({ field }) => (
						<FormItem>
							<FormLabel>E-mail</FormLabel>
							<FormControl>
								<Input placeholder="airsoft@club.com" type="email" {...field} />
							</FormControl>
							<FormDescription>{t("dashboard.club.info.emailDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="website"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("dashboard.club.info.website")}</FormLabel>
							<FormControl>
								<Input placeholder="https://..." {...field} />
							</FormControl>
							<FormDescription>{t("dashboard.club.info.website")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Instagram integration section with alerts */}
				{(props.club?.instagramConnected || props.instagramConnectionUrl) && (
					<div id="instagram" className="border rounded-lg p-4 space-y-4">
						<div className="flex sm:flex-row flex-col gap-2 items-center justify-between">
							<div className="flex items-center gap-2">
								<SiInstagram className="h-5 w-5" />
								<h4 className="font-medium">{t("dashboard.club.info.instagramConnection")}</h4>
							</div>

							{props.club?.instagramConnected ? (
								<Button
									type="button"
									variant="destructive"
									size="sm"
									onClick={handleDisconnectInstagram}
									disabled={isDisconnectingInstagram}
								>
									{isDisconnectingInstagram ? (
										<>
											<Loader className="mr-2 h-4 w-4 animate-spin" />
											{t("dashboard.club.info.instagramDisconnecting")}
										</>
									) : (
										t("dashboard.club.info.instagramDisconnect.action")
									)}
								</Button>
							) : (
								<Link href={props.instagramConnectionUrl ?? ""}>
									<Button type="button" variant="outline" size="sm" disabled={!props.club?.id}>
										{t("dashboard.club.info.instagramConnect")}
									</Button>
								</Link>
							)}
						</div>

						{/* Instagram success message */}
						{instagramSuccess && (
							<Alert>
								<CheckCircle className="h-4 w-4" />
								<AlertTitle>{t("dashboard.club.info.instagramConnectSuccess")}</AlertTitle>
							</Alert>
						)}

						{/* Instagram error message */}
						{instagramError && (
							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertTitle>{t("dashboard.club.info.instagramError.title")}</AlertTitle>
								<AlertDescription>
									{instagramErrorMessage || t(getInstagramErrorTranslationKey(instagramError))}
								</AlertDescription>
							</Alert>
						)}

						{props.club?.instagramConnected && props.club?.instagramUsername && (
							<div className="text-sm inline-flex items-center gap-1">
								<p className="text-muted-foreground">
									{t("dashboard.club.info.instagramConnectedMessage")}
								</p>
								<Link
									href={`https://instagram.com/${props.club.instagramUsername}`}
									target="_blank"
									className="text-blue-500 hover:underline flex items-center gap-1"
								>
									@{props.club.instagramUsername}
									<ArrowUpRight className="h-3 w-3" />
								</Link>
							</div>
						)}

						{!props.club?.instagramConnected && (
							<div className="text-sm">
								<p className="text-muted-foreground">{t("dashboard.club.info.instagramDescription")}</p>
							</div>
						)}
					</div>
				)}

				<LoaderSubmitButton isLoading={isLoading} disabled={!isSlugValid && !!slugValue}>
					{props.club ? t("common.actions.save") : t("common.actions.create")}
				</LoaderSubmitButton>
			</form>
		</Form>
	);
}
