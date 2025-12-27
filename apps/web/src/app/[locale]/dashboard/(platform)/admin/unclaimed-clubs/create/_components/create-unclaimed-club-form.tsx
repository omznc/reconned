"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { bs, enUS, hr } from "date-fns/locale";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SingleImageUpload } from "@/components/ui/single-image-upload";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { cn } from "@/lib/utils";

const MapSelector = dynamic(() => import("@/components/clubs-map/clubs-map").then((m) => m.ClubsMap), {
	ssr: false,
});

interface CreateUnclaimedClubFormProps {
	countries: ApiResponse<"/api/countries", "get">;
}

export function CreateUnclaimedClubForm({ countries }: CreateUnclaimedClubFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [open, setOpen] = useState(false);
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

	const createUnclaimedClubSchema = z.object({
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
		location: z.string().max(50).optional(),
		latitude: z.number().optional(),
		longitude: z.number().optional(),
		description: z.string().max(5000).optional(),
		slug: z.string().optional(),
		dateFounded: z
			.date()
			.optional()
			.refine(
				(date) => {
					if (!date) return true; // Allow empty/undefined
					const today = new Date();
					today.setHours(23, 59, 59, 999); // End of today
					return date <= today;
				},
				{
					message: t("Date founded cannot be in the future"),
				},
			),
		isAllied: z.boolean().optional(),
		isPrivate: z.boolean().optional(),
		isPrivateStats: z.boolean().optional(),
		logo: z.string().optional(),
		headerImage: z.string().optional(),
		contactPhone: z.string().optional(),
		contactEmail: z.string().optional(),
		website: z.string().optional(),
		instagramUsername: z.string().optional(),
	});
	const clubIdRef = useRef<string | null>(null);

	const logoUpload = useFileUpload({
		uploadFunction: async (file: File) => {
			const currentClubId = clubIdRef.current;
			if (!currentClubId) {
				throw new Error("Must create club first");
			}

			const { data, error } = await apiClient.POST("/api/admin/unclaimed-clubs/{id}/logo/upload-url", {
				params: {
					path: {
						id: currentClubId,
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
		initialFiles: [],
	});

	const headerUpload = useFileUpload({
		uploadFunction: async (file: File) => {
			const currentClubId = clubIdRef.current;
			if (!currentClubId) {
				throw new Error("Must create club first");
			}

			const { data, error } = await apiClient.POST("/api/admin/unclaimed-clubs/{id}/header-image/upload-url", {
				params: {
					path: {
						id: currentClubId,
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
		initialFiles: [],
	});

	const [isSlugValid, setIsSlugValid] = useState(true);
	const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);
	const [mapZoom, setMapZoom] = useState<number>(8);

	const form = useForm<z.infer<typeof createUnclaimedClubSchema>>({
		resolver: zodResolver(createUnclaimedClubSchema),
		defaultValues: {
			name: "",
			location: "",
			description: "",
			dateFounded: undefined,
			isAllied: false,
			isPrivate: false,
			isPrivateStats: false,
			contactPhone: "",
			contactEmail: "",
			slug: "",
			latitude: undefined,
			longitude: undefined,
			countryId: undefined,
			instagramUsername: "",
			website: "",
		},
	});

	const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const geocodeAbortRef = useRef<AbortController | null>(null);

	const selectedCountryId = form.watch("countryId");
	const locationValue = form.watch("location");
	const latitudeValue = form.watch("latitude");
	const longitudeValue = form.watch("longitude");
	const nameValue = form.watch("name");
	const descriptionValue = form.watch("description");
	const slugValue = form.watch("slug");

	const handleLocationSelect = (latitude: number, longitude: number) => {
		form.setValue("latitude", latitude, { shouldDirty: true });
		form.setValue("longitude", longitude, { shouldDirty: true });
		setMapCenter([latitude, longitude]);
		setMapZoom(14);
	};

	const handleLocationReset = () => {
		form.setValue("latitude", undefined, { shouldDirty: true });
		form.setValue("longitude", undefined, { shouldDirty: true });
		const selectedCountry = countries.find((country) => country.id === selectedCountryId);
		if (selectedCountry?.latitude && selectedCountry?.longitude) {
			setMapCenter([selectedCountry.latitude, selectedCountry.longitude]);
			setMapZoom(6);
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

	async function onSubmit(values: z.infer<typeof createUnclaimedClubSchema>) {
		setIsLoading(true);
		try {
			const { data, error } = await apiClient.POST("/api/admin/unclaimed-clubs", {
				body: {
					name: values.name,
					countryId: values.countryId,
					location: values.location,
					description: values.description,
					dateFounded: values.dateFounded ? values.dateFounded.toISOString() : undefined,
					isAllied: values.isAllied,
					isPrivate: values.isPrivate,
					isPrivateStats: values.isPrivateStats,
					contactPhone: values.contactPhone,
					contactEmail: values.contactEmail,
					slug: values.slug,
					latitude: values.latitude,
					longitude: values.longitude,
					website: values.website,
				},
			});

			if (error || !data?.id) {
				throw new Error();
			}

			const newClubId = data.id;
			clubIdRef.current = newClubId;

			const filesToUpload = logoUpload.files.filter((f) => f.file && !f.isExisting);
			if (filesToUpload.length > 0) {
				const uploadedUrls = await logoUpload.uploadAllFiles();
				const logoUrl = uploadedUrls[0];
				if (logoUrl) {
					await apiClient.PUT("/api/admin/unclaimed-clubs/{id}/logo", {
						params: {
							path: {
								id: newClubId,
							},
						},
						body: {
							logo: logoUrl,
						},
					});
				}
			}

			const headerFilesToUpload = headerUpload.files.filter((f) => f.file && !f.isExisting);
			if (headerFilesToUpload.length > 0) {
				const uploadedHeaderUrls = await headerUpload.uploadAllFiles();
				const headerUrl = uploadedHeaderUrls[0];
				if (headerUrl) {
					await apiClient.PUT("/api/admin/unclaimed-clubs/{id}/header-image", {
						params: {
							path: {
								id: newClubId,
							},
						},
						body: {
							headerImage: headerUrl,
						},
					});
				}
			}

			logoUpload.markAsSaved();
			headerUpload.markAsSaved();
			toast.success(t("Unclaimed club created successfully"));
			router.push("/dashboard/admin/unclaimed-clubs");
		} catch {
			toast.error(t("Failed to create unclaimed club"));
		} finally {
			setIsLoading(false);
		}
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
								{t("Club name")}* ({nameValue?.length || 0}/50)
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
												? countries.find((country) => country.id === field.value)
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

				<FormField
					control={form.control}
					name="location"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("City")}</FormLabel>
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
						<button
							type="button"
							onClick={handleLocationReset}
							data-hidden={!latitudeValue && !longitudeValue}
							className="h-6 px-2 text-xs data-[hidden=true]:opacity-0 text-muted-foreground hover:text-foreground"
						>
							{t("Reset")}
						</button>
					</FormLabel>
					<FormDescription>
						{t("Click anywhere on the map to mark where your club is located.")}
					</FormDescription>
					<FormControl>
						<div className="h-[400px] w-full rounded-lg overflow-hidden border">
							<MapSelector
								clubs={[
									{
										id: "new",
										name: nameValue || "",
										latitude: latitudeValue || null,
										longitude: longitudeValue || null,
										location: locationValue || null,
										logo: null,
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
				</FormItem>

				<FormField
					control={form.control}
					name="slug"
					render={({ field }) => (
						<SlugInput
							currentSlug={undefined}
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
								{t("Description")} ({descriptionValue?.length || 0}/5000)
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
							<FormLabel>{t("Date of establishment")}</FormLabel>
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
												new Date(field.value).toLocaleDateString()
											) : (
												<span>{t("Select a date")}</span>
											)}
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

				<div>
					<h3 className="text-lg font-semibold">{t("Contact")}</h3>
				</div>

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
					name="website"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("Website")}</FormLabel>
							<FormControl>
								<Input placeholder="https://..." {...field} />
							</FormControl>
							<FormDescription>{t("Website")}</FormDescription>
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
								<FormLabel className="text-base">{t("Private club")}</FormLabel>
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

				<LoaderSubmitButton isLoading={isLoading} disabled={!isSlugValid && !!slugValue}>
					{t("Create")}
				</LoaderSubmitButton>
			</form>
		</Form>
	);
}
