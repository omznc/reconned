"use client";
import {
	deleteClub,
	deleteClubImage,
	getClubImageUploadUrl,
	saveClubInformation,
} from "@/app/dashboard/(club)/[clubId]/club/information/_components/club-info.action";
import { clubInfoSchema } from "@/app/dashboard/(club)/[clubId]/club/information/_components/club-info.schema";
import { Button } from "@/components/ui/button";
import {
	FileInput,
	FileUploader,
	FileUploaderContent,
	FileUploaderItem,
} from "@/components/ui/file-upload";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";

import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Club } from "@prisma/client";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader, Trash } from "lucide-react";
import { CloudUpload } from "lucide-react";

import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { SlugInput } from "@/components/slug-input";

interface ClubInfoFormProps {
	club?: Club;
	isClubOwner?: boolean;
}

export function ClubInfoForm(props: ClubInfoFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [files, setFiles] = useState<File[] | null>(null);
	const [isDeletingImage, setIsDeletingImage] = useState(false);
	const [isSlugValid, setIsSlugValid] = useState(true);
	const router = useRouter();
	const confirm = useConfirm();

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
			logo: props.club?.logo || undefined,
			contactPhone: props.club?.contactPhone || undefined,
			contactEmail: props.club?.contactEmail || undefined,
			slug: props.club?.slug || undefined,
		},
		mode: "onBlur",
	});

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
					toast.error("Došlo je do greške prilikom uploada slike");
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
					toast.error("Došlo je do greške prilikom kreiranja kluba");
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
					toast.error("Došlo je do greške prilikom uploada slike");
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

			toast.success(
				props.club?.id ? "Podataci o klubu su sačuvani" : "Klub je kreiran",
			);
		} catch (error) {
			toast.error("Došlo je do greške.");
		}
		setIsLoading(false);
	}

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="space-y-4 max-w-3xl"
			>
				{props.club && (
					<Alert className="flex flex-col md:flex-row gap-1 justify-between -z-0">
						<div className="flex flex-col">
							<AlertTitle>Mijenjate podatke o klubu</AlertTitle>
							<AlertDescription>
								Promjene će biti vidljive odmah nakon što ih sačuvate.
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
											title: "Jeste li sigurni?",
											body: "Ako obrišete klub, nećete ga moći vratiti nazad.",
											actionButtonVariant: "destructive",
											actionButton: `Obriši ${props.club?.name}`,
											cancelButton: "Ne, vrati se",
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
										"Obriši klub"
									)}
								</Button>
							)}
						</div>
					</Alert>
				)}
				<div>
					<h3 className="text-lg font-semibold">Općento</h3>
				</div>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								Ime kluba* ({form.watch("name")?.length}/
								{clubInfoSchema.shape.name.maxLength})
							</FormLabel>
							<FormControl>
								<Input placeholder="ASK Veis" type="text" {...field} />
							</FormControl>
							<FormDescription>Javno vidljivo ime vašeg kluba</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="location"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Lokacija*</FormLabel>
							<FormControl>
								<Input placeholder="Livno" type="text" {...field} />
							</FormControl>
							<FormDescription>Gdje se klub nalazi?</FormDescription>
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
								Opis kluba* ({form.watch("description")?.length}/
								{clubInfoSchema.shape.description.maxLength})
							</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Besplatni ćevapi vikendom..."
									className="resize-none"
									{...field}
								/>
							</FormControl>
							<FormDescription>
								Ovo je vaša prilika da se istaknete. Šta vaš klub čini posebnim.{" "}
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="dateFounded"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>Datum osnivanja*</FormLabel>
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
												<span>Pick a date</span>
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
									/>
								</PopoverContent>
							</Popover>
							<FormDescription>Od kada je klub aktivan?</FormDescription>
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
								<FormLabel>U savezu ASK FBIH</FormLabel>
								<FormDescription>
									Ako ste dio saveza airsoft klubova u FBIH, odaberite ovu
									opciju. Provjeriti ćemo vaš status.
								</FormDescription>
							</div>
							<FormControl>
								<Switch
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
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
								<FormLabel>Privatni klub</FormLabel>
								<FormDescription>
									Sakrijte prikaz kliba javnosti. Preporučujemo da ovo ostavite
									isključeno.
								</FormDescription>
							</div>
							<FormControl>
								<Switch
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
							</FormControl>
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="logo"
					render={() => (
						<FormItem>
							<FormLabel>Logo kluba</FormLabel>
							<FormControl>
								<FileUploader
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
													<span className="font-semibold">
														Kliknite da dodate fajl
													</span>
													, ili ga samo prebacite ovde
												</p>
												<p className="text-xs text-gray-500 dark:text-gray-400">
													Dozvoljeni formati: JPG, JPEG, PNG
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
							<FormDescription>
								Preporučujemo da dodate vaš logo.
							</FormDescription>
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
										title: "Jeste li sigurni?",
										body: "Ako obrišete logo, nećete ga moći vratiti nazad.",
										actionButtonVariant: "destructive",
										actionButton: "Obriši logo",
										cancelButton: "Ne, vrati se",
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

								{isDeletingImage ? (
									<Loader className="size-5 animate-spin" />
								) : (
									"Obriši trenutni logo"
								)}
							</Button>
						</HoverCardTrigger>
						<HoverCardContent className="size-full mb-8">
							<Image
								src={`${props.club.logo}?v=${props.club.updatedAt}`}
								alt="Club logo"
								width={200}
								height={200}
							/>
						</HoverCardContent>
					</HoverCard>
				)}

				<div>
					<h3 className="text-lg font-semibold">Kontakt</h3>
				</div>

				<FormField
					control={form.control}
					name="contactPhone"
					render={({ field }) => (
						<FormItem className="flex flex-col items-start">
							<FormLabel>Telefon</FormLabel>
							<FormControl className="w-full">
								<PhoneInput
									placeholder="063 000 000"
									{...field}
									defaultCountry="BA"
								/>
							</FormControl>
							<FormDescription>
								Ovaj broj telefona će biti javno prikazan za kontakt.
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
								<Input
									placeholder="airsoft@mojklub.com"
									type="email"
									{...field}
								/>
							</FormControl>
							<FormDescription>
								Ovaj e-mail će biti javno prikazan za kontakt.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<LoaderSubmitButton isLoading={isLoading} disabled={!isSlugValid && !!form.watch("slug")}>
					{props.club ? "Spasi" : "Kreiraj klub"}
				</LoaderSubmitButton>
			</form>
		</Form>
	);
}
