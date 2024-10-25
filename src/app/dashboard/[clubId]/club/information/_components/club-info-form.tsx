"use client";
import {
	getClubImageUploadUrl,
	saveClubInformation,
} from "@/app/dashboard/[clubId]/club/information/_components/club-info.action";
import { clubInfoSchema } from "@/app/dashboard/[clubId]/club/information/_components/club-info.schema";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Club } from "@prisma/client";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { CloudUpload } from "lucide-react";

import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/ui/date-time-picker";

interface ClubInfoFormProps {
	club: Club;
}

export function ClubInfoForm(props: ClubInfoFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [files, setFiles] = useState<File[] | null>(null);

	const dropZoneConfig = {
		maxFiles: 1,
		maxSize: 1024 * 1024 * 4,
	};
	const form = useForm<z.infer<typeof clubInfoSchema>>({
		resolver: zodResolver(clubInfoSchema),
		defaultValues: {
			id: props.club.id,
			name: props.club.name || "",
			location: props.club.location || "",
			description: props.club.description || "",
			dateFounded: props.club.dateFounded || new Date(),
			isAllied: props.club.isAllied,
			isPrivate: props.club.isPrivate,
			logo: props.club.logo || undefined,
			contactPhone: props.club.contactPhone || undefined,
			contactEmail: props.club.contactEmail || undefined,
		},
		mode: "onBlur",
	});

	async function onSubmit(values: z.infer<typeof clubInfoSchema>) {
		setIsLoading(true);
		try {
			if (files && files.length > 0) {
				const resp = await getClubImageUploadUrl({
					file: files[0],
					id: props.club.id,
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

				values.logo = resp.data.url.split("?")[0];
			}

			await saveClubInformation(values);

			setFiles([]);

			toast.success("Podataci o klubu su sačuvani");
		} catch (error) {
			toast.error("Došlo je do greške prilikom spašavanja podataka");
		}
		setIsLoading(false);
	}

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="space-y-4 max-w-3xl"
			>
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
								<FormLabel>U savezu ASK FBIH*</FormLabel>
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
								<FormLabel>Javni prikaz*</FormLabel>
								<FormDescription>
									Dozvolite javno prikazivanje vašeg kluba na ovom sajtu.
									Preporučujemo da ovo ostavite uključeno.
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
					render={({ field }) => (
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
													<span className="font-semibold">Click to upload</span>
													&nbsp; or drag and drop
												</p>
												<p className="text-xs text-gray-500 dark:text-gray-400">
													SVG, PNG, JPG or GIF
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

				{/* This is a bit broken, doesn't update in prisma (???) TODO: Fix */}
				{/* {!props.club.logo.includes("default-club-image") && (
					<Button
						variant={"destructive"}
						onClick={async () => {
							await deleteClubImage({
								id: props.club.id,
							});
						}}
					>
						Obriši trenutni logo
					</Button>
				)} */}

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
				<LoaderSubmitButton isLoading={isLoading}>Spasi</LoaderSubmitButton>
			</form>
		</Form>
	);
}
