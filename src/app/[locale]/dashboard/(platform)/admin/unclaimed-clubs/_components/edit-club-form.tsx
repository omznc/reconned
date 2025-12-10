"use client";

import type { Club } from "@generated/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ArrowUpRight, Calendar as CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
	getClubHeaderImageUploadUrl,
	getClubImageUploadUrl,
	saveClubInformation,
} from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.action";
import { clubInfoSchema } from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.schema";
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
import type { Country } from "@/lib/cached-countries";
import { cn } from "@/lib/utils";

const MapSelector = dynamic(() => import("@/components/clubs-map/clubs-map").then((m) => m.ClubsMap), {
	ssr: false,
});

interface EditClubFormProps {
	club: Club;
	countries: Country[];
}

export function EditClubForm({ club, countries }: EditClubFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [isSlugValid, setIsSlugValid] = useState(true);
	const [open, setOpen] = useState(false);
	const t = useTranslations();
	const router = useRouter();

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
				throw new ActionError("Must save club first");
			}

			const resp = await getClubImageUploadUrl({
				file: {
					type: file.type,
					size: file.size,
				},
				clubId: club.id,
			});

			if (!resp?.data?.url) {
				throw new ActionError("Failed to get upload URL");
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
				throw new ActionError("Must save club first");
			}

			const resp = await getClubHeaderImageUploadUrl({
				file: {
					type: file.type,
					size: file.size,
				},
				clubId: club.id,
			});

			if (!resp?.data?.url) {
				throw new ActionError("Failed to get upload URL");
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
			dateFounded: club?.dateFounded || new Date(),
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

	const handleLocationSelect = (lat: number, lng: number) => {
		form.setValue("latitude", lat, { shouldDirty: true });
		form.setValue("longitude", lng, { shouldDirty: true });
	};

	const handleLocationReset = () => {
		if (!club) {
			return;
		}

		form.setValue("latitude", club.latitude ?? undefined, { shouldDirty: true });
		form.setValue("longitude", club.longitude ?? undefined, { shouldDirty: true });
	};

	async function onSubmit(values: z.infer<typeof clubInfoSchema>) {
		setIsLoading(true);
		try {
			const uploadedUrls = await logoUpload.uploadAllFiles();
			values.logo = uploadedUrls.length > 0 ? uploadedUrls[0] : undefined;

			const uploadedHeaderUrls = await headerUpload.uploadAllFiles();
			values.headerImage = uploadedHeaderUrls.length > 0 ? uploadedHeaderUrls[0] : undefined;

			const result = await saveClubInformation(values);

			if (result?.data?.id) {
				logoUpload.markAsSaved();
				headerUpload.markAsSaved();
				toast.success(t("dashboard.club.info.success"));
				router.push("/dashboard/admin/unclaimed-clubs");
			}
		} catch {
			toast.error(t("dashboard.club.info.error"));
		}
		setIsLoading(false);
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-3xl">
				<div>
					<h3 className="text-lg font-semibold">{t("dashboard.club.info.general")}</h3>
				</div>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								{t("dashboard.club.info.name")}* ({form.watch("name")?.length}/
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
												? countries.find((country) => country.id === field.value)?.name
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
											{countries.map((country) => (
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
								form.watch("latitude") === club?.latitude && form.watch("longitude") === club?.longitude
							}
							className="h-6 px-2 text-xs data-[hidden=true]:opacity-0"
						>
							{t("dashboard.club.info.reset")}
						</Button>
					</FormLabel>
					<FormControl>
						<div className="h-[400px] w-full rounded-lg overflow-hidden border">
							<MapSelector
								clubs={[
									{
										id: club?.id ?? "new",
										name: form.watch("name") || "",
										latitude: form.watch("latitude") || null,
										longitude: form.watch("longitude") || null,
										location: form.watch("location"),
										logo: club?.logo,
									},
								]}
								interactive={true}
								onLocationSelect={handleLocationSelect}
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
							currentSlug={club?.slug}
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
								{t("dashboard.club.info.description")}* ({form.watch("description")?.length}/
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
					name="headerImage"
					render={() => (
						<FormItem>
							<FormLabel>{t("dashboard.club.info.headerImage")}</FormLabel>
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
							<FormDescription>{t("dashboard.club.info.headerImageDescription")}</FormDescription>
							<FormMessage />
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

				<LoaderSubmitButton isLoading={isLoading} disabled={!isSlugValid && !!form.watch("slug")}>
					{t("common.actions.save")}
				</LoaderSubmitButton>
			</form>
		</Form>
	);
}
