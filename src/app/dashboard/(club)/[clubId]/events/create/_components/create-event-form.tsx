"use client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type * as z from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

import {
	ArrowUpRight,
	Calendar as CalendarIcon,
	CloudUpload,
	Eye,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { createEventFormSchema } from "@/app/dashboard/(club)/[clubId]/events/create/_components/create-event-form.schema";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import {
	DateTimePicker,
	initHourFormat,
} from "@/components/ui/date-time-picker";
import { bs } from "date-fns/locale";
import { useEffect, useState } from "react";
import {
	FileInput,
	FileUploader,
	FileUploaderContent,
	FileUploaderItem,
} from "@/components/ui/file-upload";
import {
	createEvent,
	getEventImageUploadUrl,
} from "@/app/dashboard/(club)/[clubId]/events/create/_components/create-event-form.action";
import type { Event } from "@prisma/client";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
// import MapComponent from "@/components/map-component";

const MapComponent = dynamic(
	() => import("@/components/map-component").then((mod) => mod.default),
	{
		ssr: false,
	},
);

interface CreateEventFormProps {
	event: Event | null;
}

export default function CreateEventForm(props: CreateEventFormProps) {
	const [files, setFiles] = useState<File[] | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();
	const clubId = useParams<{ clubId: string }>().clubId;

	const form = useForm<z.infer<typeof createEventFormSchema>>({
		resolver: zodResolver(createEventFormSchema),
		defaultValues: {
			id: props.event?.id || "",
			clubId: props.event?.clubId || clubId || "",
			name: props.event?.name || "",
			description: props.event?.description || "",
			costPerPerson: props.event?.costPerPerson || 0,
			location: props.event?.location || "",
			googleMapsLink: props.event?.googleMapsLink || "",
			dateStart: props.event?.dateStart || new Date(),
			dateEnd: props.event?.dateEnd || undefined,
			dateRegistrationsOpen: props.event?.dateRegistrationsOpen || new Date(),
			dateRegistrationsClose: props.event?.dateRegistrationsClose || undefined,
			coverImage: props.event?.coverImage || "",
			isPrivate: props.event?.isPrivate,
			allowFreelancers: props.event?.allowFreelancers,
			hasBreakfast: props.event?.hasBreakfast,
			hasLunch: props.event?.hasLunch,
			hasDinner: props.event?.hasDinner,
			hasSnacks: props.event?.hasSnacks,
			hasDrinks: props.event?.hasDrinks,
			hasPrizes: props.event?.hasPrizes,
			mapData: (props.event?.mapData as any) || { areas: [], pois: [] },
		},
	});

	useEffect(() => {
		form.reset();
	}, []);

	const dropZoneConfig = {
		maxFiles: 1,
		maxSize: 1024 * 1024 * 4,
	};

	async function onSubmit(values: z.infer<typeof createEventFormSchema>) {
		setIsLoading(true);
		try {
			const event = await createEvent(values);

			if (!event?.data) {
				toast.error("Došlo je do greške prilikom spašavanja podataka");
				return;
			}

			if (files && files.length > 0) {
				const resp = await getEventImageUploadUrl({
					file: {
						type: files[0].type,
						size: files[0].size,
					},
					id: event.data.id,
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

				values.coverImage = resp.data.url.split("?")[0];
				await createEvent(values).then((resp) => {
					if (resp?.data) {
						router.push(`/dashboard/${clubId}/events/${resp.data?.id}`);
					}
				});
			} else {
				router.push(`/dashboard/${clubId}/events/${event.data.id}`);
			}

			setFiles([]);
			toast.success("Podataci o susretu su sačuvani");
		} catch (error) {
			toast.error("Došlo je do greške prilikom spašavanja susreta");
		}
		setIsLoading(false);
	}

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="space-y-4 max-w-3xl"
			>
				{props.event?.id && (
					<Alert className="flex justify-between -z-0">
						<div className="flex flex-col">
							<AlertTitle>Mijenjate susret</AlertTitle>
							<AlertDescription>
								Ovaj susret je već kreiran, trenutno ga uređujete.
							</AlertDescription>
						</div>
						<Button variant="outline" asChild={true}>
							<Link
								className="flex items-center gap-1"
								href={`/dashboard/${clubId}/events/${props.event.id}`}
							>
								<Eye className="size-4" />
								Pregled
							</Link>
						</Button>
					</Alert>
				)}
				<div>
					<h3 className="text-lg font-semibold">Općenito</h3>
				</div>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Ime*</FormLabel>
							<FormControl>
								<Input placeholder="Food Wars 24" type="text" {...field} />
							</FormControl>
							<FormDescription>Ovo je naziv vašeg susreta.</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Opis*</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Ponesite pribor za jelo..."
									className="min-h-32"
									{...field}
								/>
							</FormControl>
							<FormDescription>
								Opis susreta. Ovo može biti priča, briefing, ili bilo šta što ne
								spada u druge kategorije.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="coverImage"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Slika susreta</FormLabel>
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

				<FormField
					control={form.control}
					name="costPerPerson"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Kotizacija/cijena</FormLabel>
							<FormControl>
								<Input placeholder="20" type="number" {...field} />
							</FormControl>
							<FormDescription>
								Koliko susret košta po igraču, u KM?
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="location"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Lokacija*</FormLabel>
									<FormControl>
										<Input placeholder="Livno" type="text" {...field} />
									</FormControl>
									<FormDescription>Gdje se ordžava susret?</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="googleMapsLink"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Google Maps</FormLabel>
									<FormControl>
										<Textarea
											placeholder={`<iframe src="https://www.google.com/maps/embed?pb=...`}
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Možete dodati Google Maps embed link.{" "}
										<Link
											target="_blank"
											className="font-semibold flex gap-0.5 items-center"
											href={`/dashboard/${clubId}/help#google-maps`}
										>
											Gdje to naći? <ArrowUpRight className="size-3" />
										</Link>
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div>
					<h3 className="text-lg font-semibold">Vrijeme</h3>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="dateStart"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Početak*</FormLabel>
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
														format(field.value, initHourFormat.hour24, {
															locale: bs,
														})
													) : (
														<span>Odaberite datum</span>
													)}
													<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<DateTimePicker
												value={field.value}
												onChange={field.onChange}
											/>
										</PopoverContent>
									</Popover>
									<FormDescription>Kada susret počinje?</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="dateEnd"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Kraj*</FormLabel>
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
														format(field.value, initHourFormat.hour24, {
															locale: bs,
														})
													) : (
														<span>Odaberite datum</span>
													)}
													<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<DateTimePicker
												value={field.value}
												onChange={field.onChange}
											/>
										</PopoverContent>
									</Popover>
									<FormDescription>Kada susret završava?</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="dateRegistrationsOpen"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Početak registracije</FormLabel>
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
														format(field.value, initHourFormat.hour24, {
															locale: bs,
														})
													) : (
														<span>Odaberite datum</span>
													)}
													<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<DateTimePicker
												value={field.value}
												onChange={field.onChange}
											/>
										</PopoverContent>
									</Popover>
									<FormDescription>
										Kada se igrači mogu registrirati? Ostavite prazno da
										dozvolite registraciju odmah.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="dateRegistrationsClose"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Kraj registracije*</FormLabel>
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
														format(field.value, initHourFormat.hour24, {
															locale: bs,
														})
													) : (
														<span>Odaberite datum</span>
													)}
													<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<DateTimePicker
												value={field.value}
												onChange={field.onChange}
											/>
										</PopoverContent>
									</Popover>
									<FormDescription>
										Kada završavaju registracije?
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div>
					<h3 className="text-lg font-semibold">Vidljivost</h3>
				</div>

				<FormField
					control={form.control}
					name="isPrivate"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<FormLabel>Privatni susret*</FormLabel>
								<FormDescription>
									Susret će biti vidljiv samo vašem klubu. Korisno ako planirate
									trening.
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
					name="allowFreelancers"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<FormLabel>Freelancer prijave*</FormLabel>
								<FormDescription>
									Na susret se mogu prijaviti ljudi koji nisu aktivno u nekom
									klubu.
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

				<div>
					<h3 className="text-lg font-semibold">Organizacija</h3>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasBreakfast"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Doručak</FormLabel>
										<FormDescription>
											Da li će susret imati doručak?
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
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasLunch"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Ručak</FormLabel>
										<FormDescription>
											Da li će susret imati ručak?
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
					</div>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasDinner"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Večera</FormLabel>
										<FormDescription>
											Da li će susret imati večeru?
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
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasSnacks"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Grickalice</FormLabel>
										<FormDescription>
											Da li će susret imati grickalice?
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
					</div>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasDrinks"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Pića</FormLabel>
										<FormDescription>
											Da li će susret imati pića?
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
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasPrizes"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Nagrade</FormLabel>
										<FormDescription>
											Da li će biti nagrade za pobjednike?
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
					</div>
				</div>
				<MapComponent
					defaultMapData={form.watch("mapData")}
					onSaveMapData={(data) => {
						form.setValue("mapData", data);
					}}
				/>
				<LoaderSubmitButton isLoading={isLoading}>
					{props.event ? "Ažuriraj susret" : "Kreiraj susret"}
				</LoaderSubmitButton>
			</form>
		</Form>
	);
}
