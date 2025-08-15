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
import { useEffect, useState } from "react";
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
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
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
	const [isConnectingInstagram, setIsConnectingInstagram] = useState(false);
	const confirm = useConfirm();
	const t = useTranslations("dashboard.club.info");
	const { setHasUnsavedChanges } = useUnsavedChanges();

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
			if (!props.club?.id) {
				throw new Error("Must save club first");
			}

			const resp = await getClubImageUploadUrl({
				file: {
					type: file.type,
					size: file.size,
				},
				clubId: props.club.id,
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

	// Watch for form changes using isDirty
	useEffect(() => {
		const subscription = form.watch(() => {
			const isDirty = form.formState.isDirty;
			const hasFileChanges = logoUpload.hasUnsavedChanges;
			const shouldShowIndicator = isDirty || hasFileChanges;

			// Update unsaved changes based on form state and file upload state
			setHasUnsavedChanges(shouldShowIndicator);
		});

		return () => subscription.unsubscribe();
	}, [form, setHasUnsavedChanges, logoUpload.hasUnsavedChanges]);

	// Also watch for file upload changes separately
	useEffect(() => {
		const isDirty = form.formState.isDirty;
		const hasFileChanges = logoUpload.hasUnsavedChanges;
		const shouldShowIndicator = isDirty || hasFileChanges;

		setHasUnsavedChanges(shouldShowIndicator);
	}, [logoUpload.hasUnsavedChanges, form.formState.isDirty, setHasUnsavedChanges]);

	// Add this handler for map location selection
	const handleLocationSelect = (lat: number, lng: number) => {
		form.setValue("latitude", lat, { shouldDirty: true });
		form.setValue("longitude", lng, { shouldDirty: true });
	};

	const handleLocationReset = () => {
		if (!props.club) {
			return;
		}

		form.setValue("latitude", props.club.latitude ?? undefined, { shouldDirty: true });
		form.setValue("longitude", props.club.longitude ?? undefined, { shouldDirty: true });
	};

	// Add this function to handle Instagram disconnection
	const handleDisconnectInstagram = async () => {
		if (!props.club?.id) {
			return;
		}

		const confirmed = await confirm({
			title: t("instagramDisconnect.title"),
			body: t("instagramDisconnect.body"),
			actionButtonVariant: "destructive",
			actionButton: t("instagramDisconnect.confirm"),
			cancelButton: t("instagramDisconnect.cancel"),
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

			toast.success(t("instagramDisconnectSuccess"));
			router.refresh();
		} catch (_) {
			toast.error(t("instagramDisconnectError"));
		} finally {
			setIsDisconnectingInstagram(false);
		}
	};

	// Helper function to get error message translation key
	const getInstagramErrorTranslationKey = (errorCode: string): string => {
		switch (errorCode) {
			case "no_facebook_pages":
				return "instagramError.noFacebookPages";
			case "no_instagram_business_account":
				return "instagramError.noInstagramAccount";
			case "not_connected_to_instagram":
				return "instagramError.notConnected";
			case "missing_params":
				return "instagramError.missingParams";
			case "auth_failed":
				return "instagramError.authFailed";
			case "page_not_found":
				return "instagramError.pageNotFound";
			case "personal_account":
				return "instagramError.personalAccount";
			default:
				return "instagramError.connectionFailed";
		}
	};

	async function onSubmit(values: z.infer<typeof clubInfoSchema>) {
		setIsLoading(true);
		try {
			// Upload logo and handle deletion
			const uploadedUrls = await logoUpload.uploadAllFiles();
			values.logo = uploadedUrls.length > 0 ? uploadedUrls[0] : undefined;

			const result = await saveClubInformation(values);

			if (result?.data?.id) {
				logoUpload.markAsSaved();
				setHasUnsavedChanges(false);
				toast.success(t("success"));
			}
		} catch (error) {
			toast.error(t("error"));
		}
		setIsLoading(false);
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-3xl">
				{props.club && (
					<Alert className="flex flex-col md:flex-row gap-1 justify-between -z-0">
						<div className="flex flex-col">
							<AlertTitle>{t("clubEditTitle")}</AlertTitle>
							<AlertDescription>{t("clubEditDescription")}</AlertDescription>
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
											title: t("clubDelete.title"),
											body: t("clubDelete.body"),
											actionButtonVariant: "destructive",
											actionButton: t("clubDelete.confirm"),
											cancelButton: t("clubDelete.cancel"),
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

									{isLoading ? <Loader className="animate-spin size-4" /> : t("clubDelete.confirm")}
								</Button>
							)}
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
							<FormLabel>
								{t("name")}* ({form.watch("name")?.length}/{clubInfoSchema.shape.name.maxLength})
							</FormLabel>
							<FormControl>
								<Input placeholder="Veis" type="text" {...field} />
							</FormControl>
							<FormDescription>{t("nameDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="countryId"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>{t("country")}*</FormLabel>
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
												: t("pickCountry")}
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</FormControl>
								</PopoverTrigger>
								<PopoverContent className="w-full p-0">
									<Command>
										<CommandInput placeholder={t("searchCountry")} />
										<CommandEmpty>{t("noResults")}</CommandEmpty>
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
							<FormDescription>{t("countryDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="location"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("city")}*</FormLabel>
							<FormControl>
								<Input placeholder="Livno" type="text" {...field} />
							</FormControl>
							<FormDescription>{t("cityDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormItem>
					<FormLabel className="flex items-center justify-between">
						<span>{t("exactLocation")}</span>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={handleLocationReset}
							data-hidden={
								form.watch("latitude") === props.club?.latitude &&
								form.watch("longitude") === props.club?.longitude
							}
							className="h-6 px-2 text-xs data-[hidden=true]:opacity-0"
						>
							{t("reset")}
						</Button>
					</FormLabel>
					<FormControl>
						<div className="h-[400px] w-full rounded-lg overflow-hidden border">
							<MapSelector
								clubs={[
									{
										id: props.club?.id ?? "new",
										name: form.watch("name") || "",
										latitude: form.watch("latitude") || null,
										longitude: form.watch("longitude") || null,
										location: form.watch("location"),
										logo: props.club?.logo,
									},
								]}
								interactive={true}
								onLocationSelect={handleLocationSelect}
							/>
						</div>
					</FormControl>
					<FormDescription>
						{t.rich("exactLocationDescription", {
							link: () => (
								<Link target="_blank" className="text-red-500" href="/map">
									{t("exactLocationLink")}
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
								{t("description")}* ({form.watch("description")?.length}/
								{clubInfoSchema.shape.description.maxLength})
							</FormLabel>
							<FormControl>
								<Textarea
									placeholder={t("descriptionPlaceholder")}
									className="resize-none"
									{...field}
								/>
							</FormControl>
							<FormDescription>{t("descriptionDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="dateFounded"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>{t("foundedDate")}*</FormLabel>
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
											{field.value ? format(field.value, "PPP") : <span>{t("chooseDate")}</span>}
											<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
										</Button>
									</FormControl>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="start">
									<DateTimePicker value={field.value} onChange={field.onChange} granularity="day" />
								</PopoverContent>
							</Popover>
							<FormDescription>{t("foundedDateDescription")}</FormDescription>
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
								<FormLabel>{t("isAllied")}</FormLabel>
								<FormDescription>{t("isAlliedDescription")}</FormDescription>
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
					name="isPrivateStats"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<FormLabel>{t("privateStats")}</FormLabel>
								<FormDescription>{t("privateStatsDescription")}</FormDescription>
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
							<FormLabel>{t("logo")}</FormLabel>
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
							<FormDescription>{t("logoDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div>
					<h3 className="text-lg font-semibold">{t("contact")}</h3>
				</div>

				<FormField
					control={form.control}
					name="contactPhone"
					render={({ field }) => (
						<FormItem className="flex flex-col items-start">
							<FormLabel>{t("phone")}</FormLabel>
							<FormControl className="w-full">
								<PhoneInput placeholder="063 000 000" {...field} defaultCountry="BA" />
							</FormControl>
							<FormDescription>{t("phoneDescription")}</FormDescription>
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
							<FormDescription>{t("emailDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="website"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("website")}</FormLabel>
							<FormControl>
								<Input placeholder="https://..." {...field} />
							</FormControl>
							<FormDescription>{t("website")}</FormDescription>
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
								<h4 className="font-medium">{t("instagramConnection")}</h4>
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
											{t("instagramDisconnecting")}
										</>
									) : (
										t("instagramDisconnect.action")
									)}
								</Button>
							) : (
								<Link href={props.instagramConnectionUrl ?? ""}>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={isConnectingInstagram || !props.club?.id}
									>
										{isConnectingInstagram ? (
											<>
												<Loader className="mr-2 h-4 w-4 animate-spin" />
												{t("instagramConnecting")}
											</>
										) : (
											t("instagramConnect")
										)}
									</Button>
								</Link>
							)}
						</div>

						{/* Instagram success message */}
						{instagramSuccess && (
							<Alert>
								<CheckCircle className="h-4 w-4" />
								<AlertTitle>{t("instagramConnectSuccess")}</AlertTitle>
							</Alert>
						)}

						{/* Instagram error message */}
						{instagramError && (
							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertTitle>{t("instagramError.title")}</AlertTitle>
								<AlertDescription>
									{instagramErrorMessage || t(getInstagramErrorTranslationKey(instagramError))}
								</AlertDescription>
							</Alert>
						)}

						{props.club?.instagramConnected && props.club?.instagramUsername && (
							<div className="text-sm inline-flex items-center gap-1">
								<p className="text-muted-foreground">{t("instagramConnectedMessage")}</p>
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
								<p className="text-muted-foreground">{t("instagramDescription")}</p>
							</div>
						)}
					</div>
				)}

				<LoaderSubmitButton isLoading={isLoading} disabled={!isSlugValid && !!form.watch("slug")}>
					{props.club ? t("save") : t("create")}
				</LoaderSubmitButton>
			</form>
		</Form>
	);
}
