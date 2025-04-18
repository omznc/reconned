"use client";
import {
	deleteClub,
	deleteClubImage,
	getClubImageUploadUrl,
	saveClubInformation,
	disconnectInstagramAccount,
} from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.action";
import { clubInfoSchema } from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.schema";
import { Button } from "@/components/ui/button";
import { FileInput, FileUploader, FileUploaderContent, FileUploaderItem } from "@/components/ui/file-upload";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";

import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Club } from "@prisma/client";
import { format } from "date-fns";
import { AlertCircle, ArrowUpRight, Calendar as CalendarIcon, CheckCircle, Loader, Trash } from "lucide-react";
import { CloudUpload } from "lucide-react";

import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import Image from "next/image";
import { useRouter } from "@/i18n/navigation";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { SlugInput } from "@/components/slug/slug-input";

import dynamic from "next/dynamic";
import { Link } from "@/i18n/navigation";
import type { Country } from "@/lib/cached-countries";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useHash } from "@/hooks/use-hash";
import { SiInstagram } from "@icons-pack/react-simple-icons";

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
	const [files, setFiles] = useState<File[] | null>(null);
	const [isDeletingImage, setIsDeletingImage] = useState(false);
	const [isSlugValid, setIsSlugValid] = useState(true);
	const [open, setOpen] = useState(false);
	const [isConnectingInstagram, setIsConnectingInstagram] = useState(false);
	const [isDisconnectingInstagram, setIsDisconnectingInstagram] = useState(false);
	const [instagramSuccess, setInstagramSuccess] = useState(false);
	const [instagramError, setInstagramError] = useState<string | null>(null);
	const [instagramErrorMessage, setInstagramErrorMessage] = useState<string | null>(null);
	const router = useRouter();
	const confirm = useConfirm();
	const t = useTranslations("dashboard.club.info");
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

	const dropZoneConfig = {
		maxFiles: 1,
		maxSize: 1024 * 1024 * 4,
		accept: {
			"image/jpeg": ["jpg", "jpeg"],
			"image/png": ["png"],
		},
	};

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

	// Add this handler for map location selection
	const handleLocationSelect = (lat: number, lng: number) => {
		form.setValue("latitude", lat);
		form.setValue("longitude", lng);
	};

	const handleLocationReset = () => {
		if (props.club) {
			form.setValue("latitude", props.club.latitude ?? undefined);
			form.setValue("longitude", props.club.longitude ?? undefined);
		}
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
		} catch (error) {
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
			/**
			 * If editing a club, and the logo changes, upload it.
			 */
			if (files?.[0] && props.club?.id) {
				const resp = await getClubImageUploadUrl({
					file: {
						type: files[0].type,
						size: files[0].size,
					},
					clubId: props.club.id,
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

				values.logo = resp.data.cdnUrl;
			}

			const resp = await saveClubInformation(values);
			const newClubId = resp?.data?.id;

			/**
			 * If creating a new club with a logo, upload it after the save, and re-save the club with the new logo URL.
			 */
			if (files?.[0] && !props.club?.id) {
				if (!newClubId) {
					toast.error(t("clubCreationError"));
					return;
				}
				const resp = await getClubImageUploadUrl({
					file: {
						type: files[0].type,
						size: files[0].size,
					},
					clubId: newClubId,
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

				await saveClubInformation({
					...values,
					logo: resp.data.cdnUrl,
					clubId: newClubId,
				});
			}

			if (resp?.serverError) {
				toast.error(resp.serverError);
				router.refresh();
				return;
			}

			if (!props.club?.id) {
				router.push(`/dashboard/${newClubId}/club`);
				router.refresh();
			}

			setFiles([]);

			toast.success(props.club?.id ? t("clubSaved") : t("clubCreationSuccess"));
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
											role="combobox"
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
														form.setValue("countryId", country.id);
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
						<div className="h-[400px] w-full -z-10 rounded-lg overflow-hidden border">
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
								form.setValue("slug", slug);
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
									placeholder="Besplatni ćevapi vikendom..."
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
								<FileUploader
									key={`file-uploader-${files?.length}-${files?.[0]?.name}`}
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
							<FormDescription>{t("logoDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{props.club?.id && props.club?.logo && (
					<HoverCard openDelay={100}>
						<HoverCardTrigger>
							<Button
								type="button"
								disabled={isLoading}
								variant={"destructive"}
								onClick={async () => {
									if (!props.club?.id) {
										return;
									}

									const resp = await confirm({
										title: t("logoDelete.title"),
										body: t("logoDelete.body"),
										actionButtonVariant: "destructive",
										actionButton: t("logoDelete.confirm"),
										cancelButton: t("logoDelete.cancel"),
									});

									if (!resp) {
										return;
									}

									setIsDeletingImage(true);
									await deleteClubImage({
										clubId: props.club.id,
									});
									setIsDeletingImage(false);
								}}
								className="mt-1"
							>
								<Trash className="size-4" />

								{isDeletingImage ? <Loader className="size-5 animate-spin" /> : t("logoDelete.confirm")}
							</Button>
						</HoverCardTrigger>
						<HoverCardContent className="size-full mb-8">
							<Image src={props.club.logo} alt="Club logo" width={200} height={200} />
						</HoverCardContent>
					</HoverCard>
				)}

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
								<Input placeholder="airsoft@mojklub.com" type="email" {...field} />
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
						<div className="flex items-center justify-between">
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
