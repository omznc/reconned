"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { bs, enUS, hr } from "date-fns/locale";
import { ArrowUpRight, Calendar as CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import dynamic from "next/dynamic";
import { useExtracted, useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { SlugInput } from "@/components/slug/slug-input";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import type { FileUploadItem } from "@/components/ui/file-upload";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SingleImageUpload } from "@/components/ui/single-image-upload";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useHash } from "@/hooks/use-hash";
import { Link, useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { cn } from "@/lib/utils";
import { useHttpsUrlSchema } from "@/lib/validations/schemas";

const MapSelector = dynamic(() => import("@/components/clubs-map/clubs-map").then((m) => m.ClubsMap), {
	ssr: false,
});

type AdminUnclaimed = ApiResponse<"/api/admin/unclaimed-clubs/{id}", "get">;
type Country = ApiResponse<"/api/countries", "get">[number];

interface EditClubFormProps {
	club: AdminUnclaimed;
	countries: Country[];
}

export function EditClubForm({ club, countries }: EditClubFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [isSlugValid, setIsSlugValid] = useState(true);
	const [open, setOpen] = useState(false);
	const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);
	const [mapZoom, setMapZoom] = useState<number>(8);
	const t = useExtracted();
	const locale = useLocale();
	const router = useRouter();

	// Map locale string to date-fns locale object
	const getDateFnsLocale = () => {
		switch (locale) {
			case "bs":
				return bs;
			case "hr":
				return hr;
			case "en":
				return enUS;
			default:
				return enUS;
		}
	};

	const httpsUrlSchema = useHttpsUrlSchema();

	const clubInfoSchema = z.object({
		name: z
			.string()
			.min(1, {
				message: t("Club name is required"),
			})
			.max(50, {
				message: t("Club name must be shorter than 50 characters"),
			}),
		countryId: z.number({
			error: t("Country is required"),
		}),
		location: z
			.string()
			.min(1, {
				message: t("Club location is required"),
			})
			.max(50, {
				message: t("Club location must be shorter than 50 characters"),
			}),
		latitude: z.number().optional(),
		longitude: z.number().optional(),
		description: z.string().max(5000, {
			message: t("Club description must be shorter than 5000 characters"),
		}),
		slug: z.string().optional(),
		dateFounded: z
			.date()
			.refine(
				(date) => {
					const today = new Date();
					today.setHours(23, 59, 59, 999);
					return date <= today;
				},
				{
					message: t("Date founded cannot be in the future"),
				},
			)
			.optional(),
		isAllied: z.boolean().optional(),
		isPrivate: z.boolean().optional(),
		isPrivateStats: z.boolean().optional(),
		logo: z.string().optional(),
		headerImage: z.string().optional(),
		contactPhone: z.string().optional(),
		contactEmail: z.string().optional(),
		clubId: z.string().optional(),
		website: httpsUrlSchema.optional(),
		instagramUsername: z.string().optional(),
	});

	const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const geocodeAbortRef = useRef<AbortController | null>(null);

	const initialFiles: FileUploadItem[] = club?.logo
		? [
				{
					id: `existing-${club.id}`,
					url: club.logo,
					name: "Club logo",
					type: "image/jpeg",
					isExisting: true,
				},
			]
		: [];

	const logoUpload = useFileUpload({
		uploadFunction: async (file: File) => {
			if (!club?.id) {
				throw new Error("Must save club first");
			}

			const { data, error } = await apiClient.POST("/api/clubs/{id}/logo/upload-url", {
				params: {
					path: {
						id: club.id,
					},
				},
				body: {
					file: {
						type: file.type,
						size: file.size,
					},
				},
			});

			if (error || !data?.url) {
				throw new Error("Failed to get upload URL");
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

	const initialHeaderFiles: FileUploadItem[] = club?.headerImage
		? [
				{
					id: `existing-header-${club.id}`,
					url: club.headerImage,
					name: "Club header image",
					type: "image/jpeg",
					isExisting: true,
				},
			]
		: [];

	const headerUpload = useFileUpload({
		uploadFunction: async (file: File) => {
			if (!club?.id) {
				throw new Error("Must save club first");
			}

			const { data, error } = await apiClient.POST("/api/clubs/{id}/header-image/upload-url", {
				params: {
					path: {
						id: club.id,
					},
				},
				body: {
					file: {
						type: file.type,
						size: file.size,
					},
				},
			});

			if (error || !data?.url) {
				throw new Error("Failed to get upload URL");
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
		initialFiles: initialHeaderFiles,
	});

	useHash();

	const form = useForm<z.infer<typeof clubInfoSchema>>({
		resolver: zodResolver(clubInfoSchema),
		defaultValues: {
			clubId: club?.id || "",
			name: club?.name || "",
			location: club?.location || "",
			description: club?.description || "",
			dateFounded: club?.dateFounded ? new Date(club.dateFounded) : undefined,
			isAllied: club?.isAllied,
			isPrivate: club?.isPrivate,
			isPrivateStats: club?.isPrivateStats,
			logo: club?.logo || undefined,
			headerImage: club?.headerImage || undefined,
			contactPhone: club?.contactPhone || undefined,
			contactEmail: club?.contactEmail || undefined,
			slug: club?.slug || undefined,
			latitude: club?.latitude || undefined,
			longitude: club?.longitude || undefined,
			countryId: club?.countryId || undefined,
			website: club?.website || undefined,
		},
		mode: "onBlur",
	});

	const selectedCountryId = form.watch("countryId");
	const locationValue = form.watch("location");

	const handleLocationSelect = (lat: number, lng: number) => {
		form.setValue("latitude", lat, { shouldDirty: true });
		form.setValue("longitude", lng, { shouldDirty: true });
		setMapCenter([lat, lng]);
		setMapZoom(14);
	};

	const handleLocationReset = () => {
		if (!club) {
			return;
		}

		form.setValue("latitude", club.latitude || undefined, { shouldDirty: true });
		form.setValue("longitude", club.longitude || undefined, { shouldDirty: true });
		if (club.latitude && club.longitude) {
			setMapCenter([club.latitude, club.longitude]);
			setMapZoom(14);
		} else {
			const selectedCountry = countries.find((country) => country.id === selectedCountryId);
			if (selectedCountry?.latitude && selectedCountry?.longitude) {
				setMapCenter([selectedCountry.latitude, selectedCountry.longitude]);
				setMapZoom(6);
			}
		}
	};

	useEffect(() => {
		if (geocodeTimeoutRef.current) {
			clearTimeout(geocodeTimeoutRef.current);
		}

		if (geocodeAbortRef.current) {
			geocodeAbortRef.current.abort();
		}

		if (!locationValue || locationValue.length < 3 || !selectedCountryId) {
			if (selectedCountryId && (!locationValue || locationValue.length < 3)) {
				const selectedCountry = countries.find((c) => c.id === selectedCountryId);
				if (selectedCountry?.latitude && selectedCountry?.longitude) {
					setMapCenter([selectedCountry.latitude, selectedCountry.longitude]);
					setMapZoom(6);
				}
			}
			return;
		}

		const selectedCountry = countries.find((c) => c.id === selectedCountryId);
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
	}, [locationValue, selectedCountryId, countries, form]);

	async function onSubmit(values: z.infer<typeof clubInfoSchema>) {
		setIsLoading(true);
		try {
			const uploadedUrls = await logoUpload.uploadAllFiles();
			values.logo = uploadedUrls.length > 0 ? uploadedUrls[0] : undefined;

			const uploadedHeaderUrls = await headerUpload.uploadAllFiles();
			values.headerImage = uploadedHeaderUrls.length > 0 ? uploadedHeaderUrls[0] : undefined;

			const { error } = await apiClient.PUT("/api/admin/unclaimed-clubs/{id}", {
				params: {
					path: {
						id: club.id,
					},
				},
				body: {
					name: values.name,
					location: values.location,
					description: values.description,
					dateFounded: values.dateFounded?.toISOString() || undefined,
					isAllied: values.isAllied,
					isPrivate: values.isPrivate,
					isPrivateStats: values.isPrivateStats,
					logo: values.logo,
					headerImage: values.headerImage,
					contactPhone: values.contactPhone,
					contactEmail: values.contactEmail,
					slug: values.slug,
					latitude: values.latitude,
					longitude: values.longitude,
					countryId: values.countryId,
					website: values.website,
				},
			});

			if (error) {
				throw new Error(error.error || t("An error occurred"));
			}

			logoUpload.markAsSaved();
			headerUpload.markAsSaved();
			toast.success(t("Club information has been saved"));
			router.push("/dashboard/admin/unclaimed-clubs");
		} catch {
			toast.error(t("An error occurred"));
		}
		setIsLoading(false);
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-3xl">
				<div>
					<h3 className="text-lg font-semibold">{t("General")}</h3>
				</div>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								{t("Club name")}* ({form.watch("name")?.length}/{clubInfoSchema.shape.name.maxLength})
							</FormLabel>
							<FormControl>
								<Input placeholder="Veis" type="text" {...field} />
							</FormControl>
							<FormDescription>
								{t(
									"The name of the club will be displayed everywhere on the site, if the club is public.",
								)}
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="countryId"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>{t("Country")}*</FormLabel>
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
												? countries?.find((country) => country.id === field.value)
														?.translations?.[locale]
												: t("Select a country")}
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</FormControl>
								</PopoverTrigger>
								<PopoverContent className="w-full p-0">
									<Command>
										<CommandInput placeholder={t("Search countries...")} />
										<CommandEmpty>{t("No results")}</CommandEmpty>
										<CommandGroup className="h-[300px] overflow-y-scroll">
											{countries.map((country) => {
												const countryName = country.translations?.[locale] || country.name;
												return (
													<CommandItem
														key={country.id}
														value={countryName}
														onSelect={() => {
															form.setValue("countryId", country.id, {
																shouldDirty: true,
															});
															setOpen(false);
														}}
													>
														<Check
															className={cn(
																"mr-2 h-4 w-4",
																country.id === field.value
																	? "opacity-100"
																	: "opacity-0",
															)}
														/>
														{country.emoji} {countryName}
													</CommandItem>
												);
											})}
										</CommandGroup>
									</Command>
								</PopoverContent>
							</Popover>
							<FormDescription>{t("The country where the club is located")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="location"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("City")}*</FormLabel>
							<FormControl>
								<Input placeholder="Livno" type="text" {...field} />
							</FormControl>
							<FormDescription>{t("The city where the club is located")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormItem>
					<FormLabel className="flex items-center justify-between">
						<span>{t("Exact location")}</span>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={handleLocationReset}
							data-hidden={
								form.watch("latitude") === club?.latitude && form.watch("longitude") === club?.longitude
							}
							className="h-6 px-2 text-xs data-[hidden=true]:opacity-0"
						>
							{t("Reset")}
						</Button>
					</FormLabel>
					<FormControl>
						<div className="h-[400px] w-full rounded-lg overflow-hidden border">
							<MapSelector
								clubs={[
									{
										id: club?.id || "new",
										name: form.watch("name") || "",
										latitude: form.watch("latitude") || null,
										longitude: form.watch("longitude") || null,
										location: form.watch("location") || null,
										logo: club?.logo || null,
										slug: club?.slug || null,
										verified: club?.verified || false,
										description: club?.description || null,
										isPrivate: club?.isPrivate || false,
										isAllied: club?.isAllied || false,
										dateFounded: club?.dateFounded || null,
										website: club?.website || null,
										instagramUsername: club?.instagramUsername || null,
										contactEmail: club?.contactEmail || null,
										contactPhone: club?.contactPhone || null,
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
						{t.rich(
							"Click on the map to mark the exact location of your club. If your club is public, you'll be able to see it on the <link></link>",
							{
								link: () => (
									<Link target="_blank" className="text-red-500" href="/map">
										{t("airsoft clubs map")}
										<ArrowUpRight className="inline-block h-4 w-4 ml-1" />
									</Link>
								),
							},
						)}
					</FormDescription>
				</FormItem>

				<FormField
					control={form.control}
					name="slug"
					render={({ field }) => (
						<SlugInput
							currentSlug={club?.slug}
							currentId={club?.id}
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
								{t("Description")}* ({form.watch("description")?.length}/
								{clubInfoSchema.shape.description.maxLength})
							</FormLabel>
							<FormControl>
								<Textarea
									placeholder={t("This is a cool description")}
									className="resize-none"
									{...field}
								/>
							</FormControl>
							<FormDescription>{t("Describe your club in a few sentences")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="dateFounded"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>{t("Date of establishment")}*</FormLabel>
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
												<span>{t("Select a date")}</span>
											)}
											<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
										</Button>
									</FormControl>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="start">
									<DateTimePicker
										value={field.value}
										onChange={field.onChange}
										granularity="day"
										locale={getDateFnsLocale()}
									/>
								</PopoverContent>
							</Popover>
							<FormDescription>{t("When was the club founded?")}</FormDescription>
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
								<FormLabel>{t("In the ASK FBIH alliance")}</FormLabel>
								<FormDescription>
									{t("If you are part of the SAKFBIH, select this option. Will be verified.")}
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
					name="isPrivate"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<FormLabel>{t("Private club")}</FormLabel>
								<FormDescription>
									{t("Private clubs are only visible to club members. ")}
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
					name="isPrivateStats"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<FormLabel>{t("Private Statistics")}</FormLabel>
								<FormDescription>
									{t("Only club members can see how many views the club has")}
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
					name="headerImage"
					render={() => (
						<FormItem>
							<FormLabel>{t("Header image")}</FormLabel>
							<FormControl>
								<SingleImageUpload
									variant="banner"
									value={headerUpload.files}
									onChange={headerUpload.setFiles}
									maxFileSize={8 * 1024 * 1024}
									accept={{
										"image/jpeg": [".jpg", ".jpeg"],
										"image/png": [".png"],
										"image/webp": [".webp"],
									}}
								/>
							</FormControl>
							<FormDescription>
								{t("Add a wide banner image for your club page (1200x300).")}
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="logo"
					render={() => (
						<FormItem>
							<FormLabel>{t("Logo")}</FormLabel>
							<FormControl>
								<SingleImageUpload
									variant="logo"
									value={logoUpload.files}
									onChange={logoUpload.setFiles}
									maxFileSize={4 * 1024 * 1024}
									accept={{
										"image/jpeg": [".jpg", ".jpeg"],
										"image/png": [".png"],
										"image/webp": [".webp"],
									}}
								/>
							</FormControl>
							<FormDescription>{t("Add a club logo (600x600).")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div>
					<h3 className="text-lg font-semibold">{t("Contact")}</h3>
				</div>

				<FormField
					control={form.control}
					name="contactPhone"
					render={({ field }) => (
						<FormItem className="flex flex-col items-start">
							<FormLabel>{t("Phone number")}</FormLabel>
							<FormControl className="w-full">
								<PhoneInput placeholder="063 000 000" {...field} defaultCountry="BA" />
							</FormControl>
							<FormDescription>
								{t("The club's phone number, publicly displayed on the profile.")}
							</FormDescription>
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
							<FormDescription>
								{t("Email address of the club, publicly displayed on the profile.")}
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="website"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("Website")}</FormLabel>
							<FormControl>
								<Input placeholder="https://..." maxLength={150} {...field} />
							</FormControl>
							<FormDescription>{t("Website")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<LoaderSubmitButton isLoading={isLoading} disabled={!isSlugValid && !!form.watch("slug")}>
					{t("Save")}
				</LoaderSubmitButton>
			</form>
		</Form>
	);
}
