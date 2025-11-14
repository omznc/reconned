"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
	createUnclaimedClub,
	getUnclaimedClubLogoUploadUrl,
	updateUnclaimedClubLogo,
} from "@/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/unclaimed-clubs.actions";
import { createUnclaimedClubSchema } from "@/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/unclaimed-club.schema";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { FileUpload } from "@/components/ui/file-upload";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload } from "@/hooks/use-file-upload";
import type { Country } from "@/lib/cached-countries";
import { cn } from "@/lib/utils";

const MapSelector = dynamic(() => import("@/components/clubs-map/clubs-map").then((m) => m.ClubsMap), {
	ssr: false,
});

interface CreateUnclaimedClubFormProps {
	countries: Country[];
}

export function CreateUnclaimedClubForm({ countries }: CreateUnclaimedClubFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [open, setOpen] = useState(false);
	const t = useTranslations();
	const router = useRouter();

	const [clubId, setClubId] = useState<string | null>(null);

	const logoUpload = useFileUpload({
		uploadFunction: async (file: File) => {
			if (!clubId) {
				throw new Error("Must create club first");
			}

			const resp = await getUnclaimedClubLogoUploadUrl({
				file: {
					type: file.type,
					size: file.size,
				},
				clubId,
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
		initialFiles: [],
	});

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
		},
	});

	const handleLocationSelect = (latitude: number, longitude: number) => {
		form.setValue("latitude", latitude, { shouldDirty: true });
		form.setValue("longitude", longitude, { shouldDirty: true });
	};

	const handleLocationReset = () => {
		form.setValue("latitude", undefined, { shouldDirty: true });
		form.setValue("longitude", undefined, { shouldDirty: true });
	};

	async function onSubmit(values: z.infer<typeof createUnclaimedClubSchema>) {
		setIsLoading(true);
		try {
			const result = await createUnclaimedClub({
				name: values.name,
				countryId: values.countryId,
				location: values.location,
				description: values.description,
				dateFounded: values.dateFounded,
				isAllied: values.isAllied,
				isPrivate: values.isPrivate,
				isPrivateStats: values.isPrivateStats,
				contactPhone: values.contactPhone,
				contactEmail: values.contactEmail,
				slug: values.slug,
				latitude: values.latitude,
				longitude: values.longitude,
				instagramUsername: values.instagramUsername,
				website: values.website,
			});

			if (!result?.data?.id) {
				throw new Error();
			}

			const newClubId = result.data.id;
			setClubId(newClubId);

			if (logoUpload.files.length > 0) {
				const uploadedUrls = await logoUpload.uploadAllFiles();
				const logoUrl = uploadedUrls[0];
				if (logoUrl) {
					await updateUnclaimedClubLogo({
						clubId: newClubId,
						logo: logoUrl,
					});
				}
			}

			logoUpload.markAsSaved();
			toast.success(t("dashboard.admin.unclaimedClubs.createdSuccess"));
			router.push("/dashboard/admin/unclaimed-clubs");
		} catch {
			toast.error(t("dashboard.admin.unclaimedClubs.createdError"));
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-3xl">
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								{t("dashboard.club.info.name")}* ({form.watch("name")?.length ?? 0}/50)
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

				<FormField
					control={form.control}
					name="location"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("dashboard.club.info.city")}</FormLabel>
							<FormControl>
								<Input placeholder="Livno" type="text" {...field} />
							</FormControl>
							<FormDescription>{t("dashboard.club.info.cityDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{form.watch("location") && (
					<FormItem>
						<FormLabel className="flex items-center justify-between">
							<span>{t("dashboard.club.info.exactLocation")}</span>
							<button
								type="button"
								onClick={handleLocationReset}
								data-hidden={!form.watch("latitude") && !form.watch("longitude")}
								className="h-6 px-2 text-xs data-[hidden=true]:opacity-0 text-muted-foreground hover:text-foreground"
							>
								{t("dashboard.club.info.reset")}
							</button>
						</FormLabel>
						<FormControl>
							<div className="h-[400px] w-full rounded-lg overflow-hidden border">
								<MapSelector
									clubs={[
										{
											id: "new",
											name: form.watch("name") || "",
											latitude: form.watch("latitude") || null,
											longitude: form.watch("longitude") || null,
											location: form.watch("location"),
											logo: null,
										},
									]}
									interactive={true}
									onLocationSelect={handleLocationSelect}
								/>
							</div>
						</FormControl>
					</FormItem>
				)}

				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								{t("dashboard.club.info.description")} ({form.watch("description")?.length ?? 0}/5000)
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
							<FormLabel>{t("dashboard.club.info.foundedDate")}</FormLabel>
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
												<span>{t("dashboard.club.info.chooseDate")}</span>
											)}
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

				<div>
					<h3 className="text-lg font-semibold">{t("dashboard.club.info.contact")}</h3>
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
							<FormDescription>{t("dashboard.club.info.emailDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

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
					name="isPrivate"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<FormLabel className="text-base">{t("dashboard.club.info.private")}</FormLabel>
								<FormDescription>{t("dashboard.club.info.privateDescription")}</FormDescription>
							</div>
							<FormControl>
								<Switch checked={field.value} onCheckedChange={field.onChange} />
							</FormControl>
						</FormItem>
					)}
				/>

				<LoaderSubmitButton isLoading={isLoading}>{t("common.actions.create")}</LoaderSubmitButton>
			</form>
		</Form>
	);
}
