"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	AlertCircle,
	ArrowUpRight,
	Calendar as CalendarIcon,
	Check,
	CheckCircle,
	ChevronsUpDown,
	Trash,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useExtracted, useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { BannerCropDialog } from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/banner-crop-dialog";
import { CityCombobox } from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/city-combobox";
import { useClubs } from "@/components/clubs-provider";
import { InstagramIcon } from "@/components/icons";
import { Loader } from "@/components/loader";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { SlugInput } from "@/components/slug/slug-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
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
import type { ApiResponse, Club } from "@/lib/api/api-type-helpers";
import { getDateFnsLocale } from "@/lib/date-locale";
import { cn } from "@/lib/utils";
import { useHttpsUrlSchema } from "@/lib/validations/schemas";

type Country = ApiResponse<"/api/countries", "get">[number];
type Alliance = {
	id: number;
	name: string;
	description: string | null;
	countryId: number;
};

// Dynamically import map to avoid SSR issues
const MapSelector = dynamic(() => import("@/components/clubs-map/clubs-map").then((m) => m.ClubsMap), {
	ssr: false,
});

interface ClubInfoFormProps {
	club?: Omit<Club, "_count"> | null;
	isClubOwner?: boolean;
	countries: Country[];
	instagramConnectionUrl?: string;
}

async function deleteClub(_: unknown, clubId: string) {
	const { error } = await apiClient.DELETE("/api/clubs/{id}", {
		params: {
			path: { id: clubId },
		},
	});

	if (error) {
		throw new Error(error.error || "Failed to delete club");
	}
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
	const [cropBannerFile, setCropBannerFile] = useState<File | null>(null);
	const [selectedAllianceIds, setSelectedAllianceIds] = useState<number[]>([]);
	const confirm = useConfirm();
	const queryClient = useQueryClient();
	const t = useExtracted();
	const locale = useLocale();
	const dateFnsLocale = getDateFnsLocale(locale);
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
		// The city is picked from the seeded reference table, so what travels is an
		// id. Nullable rather than merely optional: clearing an already-set city has
		// to be distinguishable from not touching the field.
		cityId: z.number().nullable().optional(),
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
					today.setHours(23, 59, 59, 999); // End of today
					return date <= today;
				},
				{
					message: t("Date founded cannot be in the future"),
				},
			)
			.optional(),

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
	const clubIdRef = useRef<string | null>(props.club?.id || null);
	const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const geocodeAbortRef = useRef<AbortController | null>(null);

	async function saveClubInformation(values: z.infer<typeof clubInfoSchema>, clubId?: string) {
		const { clubId: _clubId, dateFounded, ...rest } = values;

		const body = {
			...rest,
			...(dateFounded ? { dateFounded: dateFounded.toISOString() } : {}),
		};

		if (clubId) {
			const { data, error } = await apiClient.PUT("/api/clubs/{id}", {
				params: {
					path: { id: clubId },
				},
				body,
			});

			if (error || !data?.success) {
				throw new Error(error?.error || "Failed to update club");
			}

			return { id: clubId };
		}

		const { data, error } = await apiClient.POST("/api/clubs", {
			body,
		});

		if (error || !data?.id) {
			throw new Error(error?.error || "Failed to create club");
		}

		return { id: data.id };
	}

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

			const { data, error } = await apiClient.POST("/api/clubs/{id}/logo/upload-url", {
				params: {
					path: { id: currentClubId },
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

	// Initialize file upload system for header image
	const initialHeaderFiles: FileUploadItem[] = props.club?.headerImage
		? [
				{
					id: `existing-header-${props.club.id}`,
					url: props.club.headerImage,
					name: "Club header image",
					type: "image/jpeg",
					isExisting: true,
				},
			]
		: [];

	const headerUpload = useFileUpload({
		uploadFunction: async (file: File) => {
			const currentClubId = clubIdRef.current;
			if (!currentClubId) {
				throw new Error("Must save club first");
			}

			const { data, error } = await apiClient.POST("/api/clubs/{id}/header-image/upload-url", {
				params: {
					path: { id: currentClubId },
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

	const router = useRouter();
	const searchParams = useSearchParams();
	const { refreshClubs } = useClubs();

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
			cityId: props.club?.cityId ?? null,
			description: props.club?.description || "",
			dateFounded: props.club?.dateFounded ? new Date(props.club.dateFounded) : undefined,

			isPrivate: props.club?.isPrivate,
			isPrivateStats: props.club?.isPrivateStats,
			logo: props.club?.logo || undefined,
			headerImage: props.club?.headerImage || undefined,
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

	// Fetch alliances when country changes
	const { data: availableAlliances = [], isLoading: loadingAlliances } = useQuery({
		queryKey: ["alliances", selectedCountryId],
		queryFn: async () => {
			if (!selectedCountryId) {
				return [];
			}

			const { data } = await apiClient.GET("/api/alliances/{countryId}", {
				params: {
					path: {
						countryId: selectedCountryId,
					},
				},
			});

			return (data?.alliances || []) as Alliance[];
		},
		enabled: !!selectedCountryId,
	});

	// Fetch current club alliances on mount
	const { data: clubAlliancesData } = useQuery({
		queryKey: ["club", props.club?.id, "alliances"],
		queryFn: async () => {
			if (!props.club?.id) {
				return [];
			}

			const { data } = await apiClient.GET("/api/clubs/{id}/alliances", {
				params: {
					path: { id: props.club.id },
				},
			});

			return (data?.alliances || []) as Alliance[];
		},
		enabled: !!props.club?.id,
	});

	// Update selected alliance IDs when club alliances are fetched
	useEffect(() => {
		if (clubAlliancesData) {
			setSelectedAllianceIds(clubAlliancesData.map((a: Alliance) => a.id));
		}
	}, [clubAlliancesData]);

	// Add this handler for map location selection
	const handleLocationSelect = (lat: number, lng: number) => {
		form.setValue("latitude", lat, { shouldDirty: true });
		form.setValue("longitude", lng, { shouldDirty: true });
		setMapCenter([lat, lng]);
		setMapZoom(14);
	};

	const handleLocationReset = () => {
		if (props.club) {
			form.setValue("latitude", props.club.latitude || undefined, { shouldDirty: true });
			form.setValue("longitude", props.club.longitude || undefined, { shouldDirty: true });
			if (props.club.latitude && props.club.longitude) {
				setMapCenter([props.club.latitude, props.club.longitude]);
				setMapZoom(14);
				return;
			}
		}

		const selectedCountry = props.countries.find((country) => country.id === selectedCountryId);
		if (typeof selectedCountry?.latitude === "number" && typeof selectedCountry.longitude === "number") {
			setMapCenter([selectedCountry.latitude, selectedCountry.longitude]);
			setMapZoom(6);
		}
	};

	const handleBannerCrop = (croppedFile: File) => {
		// Replace the current file with the cropped version
		const newFile: FileUploadItem = {
			id: `cropped-banner-${Date.now()}`,
			file: croppedFile,
			name: croppedFile.name,
			type: croppedFile.type,
			size: croppedFile.size,
			isExisting: false,
		};
		headerUpload.setFiles([newFile]);
		setCropBannerFile(null);
	};

	const handleCloseBannerCrop = () => {
		setCropBannerFile(null);
	};

	// Add this function to handle Instagram disconnection
	const handleDisconnectInstagram = async () => {
		if (!props.club?.id) {
			return;
		}

		const confirmed = await confirm({
			title: t("Disconnect Instagram Account"),
			body: t(
				"Are you sure you want to disconnect the Instagram account? After disconnecting, photos will no longer be displayed on the club profile.",
			),
			actionButtonVariant: "destructive",
			actionButton: t("Confirm"),
			cancelButton: t("Cancel"),
		});

		if (!confirmed) {
			return;
		}

		setIsDisconnectingInstagram(true);
		try {
			const { error } = await apiClient.POST("/api/clubs/{id}/instagram/disconnect", {
				params: { path: { id: props.club.id } },
			});

			if (error) {
				throw new Error(error.error || "An error occurred while disconnecting Instagram account");
			}

			toast.success(t("Instagram account successfully disconnected"));
			router.refresh();
		} catch (_) {
			toast.error(t("An error occurred while disconnecting Instagram account"));
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
			if (typeof selectedCountry?.latitude === "number" && typeof selectedCountry.longitude === "number") {
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
					`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1`,
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

					// The geocoder used to guess the city listing too. It no longer does:
					// its answers are administrative units, not places ("Mjesna zajednica
					// Trg oslobođenja-Centar" for a pin in central Sarajevo), and there is
					// no reliable way to turn one into a city from here. The picker below
					// is a list of real cities, so the guess is not worth the wrong ones.
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

	const getInstagramErrorMessage = (errorCode: string): string => {
		switch (errorCode) {
			case "no_facebook_pages":
				return t("We couldn't find any Facebook Pages connected to your account.");
			case "no_instagram_business_account":
				return t("We couldn't find an Instagram Business account connected to the selected Facebook page.");
			case "not_connected_to_instagram":
				return t("Instagram account is not connected to your Facebook page.");
			case "missing_params":
				return t("Missing parameters for connecting to Instagram API.");
			case "auth_failed":
				return t("Authorization failed. Please try again.");
			case "page_not_found":
				return t("Facebook Page not found.");
			case "personal_account":
				return t(
					"The Instagram account connected to the selected Facebook page is not a Business account. You need to use an Instagram Business account to connect.",
				);
			default:
				return t("Problem connecting to Instagram account. Please try again.");
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

				if (!result?.id) {
					throw new Error("Failed to create club");
				}

				clubId = result.id;
				clubIdRef.current = clubId;
			}

			const filesToUpload = logoUpload.files.filter((f) => f.file && !f.isExisting);
			const headerFilesToUpload = headerUpload.files.filter((f) => f.file && !f.isExisting);

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

			if (headerFilesToUpload.length > 0 && clubId) {
				const uploadedHeaderUrls = await headerUpload.uploadAllFiles();
				const headerUrl = uploadedHeaderUrls[0];
				if (headerUrl) {
					values.headerImage = headerUrl;
				}
			} else {
				const existingHeaderUrls = headerUpload.files
					.filter((f) => f.isExisting && f.url)
					.map((f) => f.url)
					.filter((url): url is string => url !== undefined);
				values.headerImage = existingHeaderUrls.length > 0 ? existingHeaderUrls[0] : undefined;
			}

			if (!isCreating || filesToUpload.length > 0 || headerFilesToUpload.length > 0) {
				if (!clubId) {
					throw new Error("Club ID is missing");
				}
				await saveClubInformation(values, clubId);
			}

			// Update club alliances
			if (clubId) {
				try {
					await apiClient.PUT("/api/clubs/{id}/alliances", {
						params: {
							path: { id: clubId },
						},
						body: {
							allianceIds: selectedAllianceIds,
						},
					});
					// Invalidate alliance queries to refetch
					queryClient.invalidateQueries({ queryKey: ["club", clubId, "alliances"] });
				} catch (error) {
					console.error("Failed to update alliances:", error);
					toast.error(t("Failed to update alliances"));
				}
			}

			logoUpload.markAsSaved();
			headerUpload.markAsSaved();
			toast.success(t("Club information has been saved"));

			if (isCreating && clubId) {
				await refreshClubs();
				router.push(`/dashboard/${clubId}/club`);
				router.refresh();
			} else {
				// Refresh breadcrumbs and data when updating existing club
				router.refresh();
			}
		} catch (error) {
			console.error("Error saving club information:", error);
			const errorMessage = error instanceof Error ? error.message : t("An error occurred");
			toast.error(errorMessage);
		}
		setIsLoading(false);
	}

	return (
		<>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-3xl">
					{props.club && (
						<Alert className="flex flex-col md:flex-row gap-1 justify-between -z-0">
							<div className="flex flex-col">
								<AlertTitle>{t("You are changing your club information")}</AlertTitle>
								<AlertDescription>
									{t("Changes will be visible immediately after you save them.")}
								</AlertDescription>
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
												title: t("Are you sure?"),
												body: t("If you delete a club, you won't be able to get it back."),
												actionButtonVariant: "destructive",
												actionButton: t("Delete the club"),
												cancelButton: t("No, come back"),
											});
											if (resp) {
												setIsLoading(true);
												if (!props.club?.id) {
													throw new Error("Club ID is missing");
												}
												await deleteClub({}, props.club.id);
												setIsLoading(false);
											}
										}}
									>
										<Trash className="size-4" />

										{isLoading ? <Loader size={16} /> : t("Delete the club")}
									</Button>
								)}
							</div>
						</Alert>
					)}
					<div>
						<h3 className="text-lg font-semibold">{t("General")}</h3>
					</div>

					{/* Banner/Header Image */}
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
										onChange={(files) => {
											if (files.length > 0 && files[0]?.file) {
												setCropBannerFile(files[0].file);
											} else {
												headerUpload.setFiles(files);
											}
										}}
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

					{/* Logo */}
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

					{/* Club Name */}
					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									{t("Club name")}* ({nameValue?.length || 0}/50)
								</FormLabel>
								<FormControl>
									<Input placeholder="Veis" type="text" maxLength={50} {...field} />
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
												{(() => {
													if (!field.value) {
														return t("Select a country");
													}

													const selectedCountry = props.countries.find(
														(country) => country.id === field.value,
													);

													if (!selectedCountry) {
														return t("Select a country");
													}

													const translations = selectedCountry.translations;

													if (
														translations &&
														typeof translations === "object" &&
														!Array.isArray(translations)
													) {
														const typedTranslations = translations as Record<
															string,
															string
														>;
														return typedTranslations[locale] || selectedCountry.name;
													}

													return selectedCountry.name;
												})()}
												<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
											</Button>
										</FormControl>
									</PopoverTrigger>
									<PopoverContent className="w-full p-0">
										<Command>
											<CommandInput placeholder={t("Search countries...")} />
											<CommandEmpty>{t("No results")}</CommandEmpty>
											<CommandGroup className="h-[300px] overflow-y-scroll">
												{props.countries.map((country) => {
													const translations = country.translations;
													let countryName = country.name;

													if (
														translations &&
														typeof translations === "object" &&
														!Array.isArray(translations)
													) {
														const typedTranslations = translations as Record<
															string,
															string
														>;
														countryName = typedTranslations[locale] || country.name;
													}

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
									<Input placeholder="Livno" type="text" maxLength={50} {...field} />
								</FormControl>
								<FormDescription>{t("The city where the club is located")}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="cityId"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("City listing")}</FormLabel>
								<FormControl>
									<CityCombobox
										value={field.value ?? null}
										initialLabel={props.club?.city}
										countryId={selectedCountryId ?? null}
										onChange={(city) =>
											form.setValue("cityId", city?.id ?? null, { shouldDirty: true })
										}
									/>
								</FormControl>
								<FormDescription>
									{t("The city page your club is listed on. Pick the nearest city to you.")}
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="slug"
						render={({ field }) => (
							<SlugInput
								currentSlug={props.club?.slug}
								currentId={props.club?.id}
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

					{/* Map and exact location */}
					<FormItem>
						<FormLabel className="flex items-center justify-between">
							<span>{t("Exact location")}</span>
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
								{t("Reset")}
							</Button>
						</FormLabel>
						<FormDescription>
							{t("Click anywhere on the map to mark where your club is located.")}
						</FormDescription>
						<FormControl>
							<div className="h-[400px] w-full rounded-lg overflow-hidden border">
								<MapSelector
									clubs={[
										props.club
											? {
													...props.club,
													name: nameValue || props.club.name,
													latitude: latitudeValue || props.club.latitude,
													longitude: longitudeValue || props.club.longitude,
													location: locationValue || props.club.location,
												}
											: {
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

					{/* Description */}
					<FormField
						control={form.control}
						name="description"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									{t("Description")}* ({descriptionValue?.length || 0}/ 5000)
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
											locale={dateFnsLocale}
										/>
									</PopoverContent>
								</Popover>
								<FormDescription>{t("When was the club founded?")}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="space-y-4">
						<div>
							<h3 className="text-lg font-semibold">{t("Alliances")}</h3>
							<p className="text-sm text-muted-foreground mt-1">
								{t("Select which alliances this club belongs to")}
							</p>
						</div>

						{loadingAlliances ? (
							<div className="flex items-center justify-center p-8 rounded-lg border">
								<div className="text-sm text-muted-foreground">{t("Loading alliances...")}</div>
							</div>
						) : availableAlliances.length === 0 ? (
							<div className="flex items-center justify-center p-8 rounded-lg border bg-muted/50">
								<div className="text-sm text-muted-foreground text-center">
									{selectedCountryId
										? t("No alliances available for this country")
										: t("Select a country first to see available alliances")}
								</div>
							</div>
						) : (
							<div className="space-y-2">
								{availableAlliances.map((alliance: Alliance) => (
									<div
										key={alliance.id}
										className="flex flex-row items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
									>
										<div className="space-y-0.5 flex-1">
											<div className="font-medium">{alliance.name}</div>
											{alliance.description && (
												<div className="text-sm text-muted-foreground">
													{alliance.description}
												</div>
											)}
										</div>
										<Switch
											id={`alliance-${alliance.id}`}
											checked={selectedAllianceIds.includes(alliance.id)}
											onCheckedChange={(checked) => {
												if (checked) {
													setSelectedAllianceIds([...selectedAllianceIds, alliance.id]);
												} else {
													setSelectedAllianceIds(
														selectedAllianceIds.filter((id) => id !== alliance.id),
													);
												}
											}}
										/>
									</div>
								))}
							</div>
						)}

						{/* Alliance contact message */}
						<div className="text-sm text-muted-foreground mt-4 p-4 rounded-lg bg-muted/30 border">
							{t.rich("Can't find your alliance? <link>Contact us here</link> to add it.", {
								link: () => {
									const selectedCountry = props.countries.find(
										(country) => country.id === selectedCountryId,
									);
									const countryName = selectedCountry?.name || t("your country");
									const subject = encodeURIComponent(
										t("Alliance Request for {country}", { country: countryName }),
									);
									const body = encodeURIComponent(
										t(
											"Hi RECONNED team,\n\nI'd like to request adding a new alliance for {country}.\n\nAlliance name: \nDescription: \n\nThank you!",
											{ country: countryName },
										),
									);
									return (
										<a
											href={`mailto:contact@reconned.com?subject=${subject}&body=${body}`}
											className="text-blue-500 hover:underline"
										>
											{t("Contact us here")}
										</a>
									);
								},
							})}
						</div>
					</div>

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
									<Input placeholder="airsoft@club.com" type="email" maxLength={255} {...field} />
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

					{/* Instagram integration section with alerts */}
					{(props.club?.instagramConnected || props.instagramConnectionUrl) && (
						<div id="instagram" className="border rounded-lg p-4 space-y-4 mt-4">
							<div className="flex sm:flex-row flex-col gap-2 items-center justify-between">
								<div className="flex items-center gap-2">
									<InstagramIcon className="h-5 w-5" />
									<h4 className="font-medium">{t("Instagram Connection")}</h4>
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
												<Loader size={16} />
												{t("Disconnecting...")}
											</>
										) : (
											t("Disconnect Instagram")
										)}
									</Button>
								) : (
									<Link href={props.instagramConnectionUrl || ""}>
										<Button type="button" variant="outline" size="sm" disabled={!props.club?.id}>
											{t("Connect Instagram")}
										</Button>
									</Link>
								)}
							</div>

							{/* Instagram success message */}
							{instagramSuccess && (
								<Alert>
									<CheckCircle className="h-4 w-4" />
									<AlertTitle>{t("Instagram account successfully connected")}</AlertTitle>
								</Alert>
							)}

							{/* Instagram error message */}
							{instagramError && (
								<Alert variant="destructive">
									<AlertCircle className="h-4 w-4" />
									<AlertTitle>{t("Problem connecting Instagram account")}</AlertTitle>
									<AlertDescription>
										{instagramErrorMessage || getInstagramErrorMessage(instagramError)}
									</AlertDescription>
								</Alert>
							)}

							{props.club?.instagramConnected && props.club?.instagramUsername && (
								<div className="text-sm inline-flex items-center gap-1">
									<p className="text-muted-foreground">
										{t("Your club is connected to an Instagram account")}
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
									<p className="text-muted-foreground">
										{t(
											"Connect your Instagram account to display club photos on the club profile.",
										)}
									</p>
								</div>
							)}
						</div>
					)}

					<LoaderSubmitButton isLoading={isLoading} disabled={!isSlugValid && !!slugValue}>
						{props.club ? t("Save") : t("Create")}
					</LoaderSubmitButton>
				</form>
			</Form>

			<BannerCropDialog file={cropBannerFile} onClose={handleCloseBannerCrop} onCrop={handleBannerCrop} />
		</>
	);
}
