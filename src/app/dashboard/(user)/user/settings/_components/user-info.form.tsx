"use client";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "@prisma/client";
import { CloudUpload, Loader, Trash } from "lucide-react";

import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { toast } from "sonner";
import { userInfoShema } from "@/app/dashboard/(user)/user/settings/_components/user-info.schema";
import {
	deleteUserImage,
	getUserImageUploadUrl,
	saveUserInformation,
} from "@/app/dashboard/(user)/user/settings/_components/user-info.action";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
	HoverCard,
	HoverCardTrigger,
	HoverCardContent,
} from "@/components/ui/hover-card";
import { useConfirm } from "@/components/ui/alert-dialog-provider";

interface UserInfoFormProps {
	user: User;
}

export function UserInfoForm(props: UserInfoFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [isDeletingImage, setIsDeletingImage] = useState(false);
	const [files, setFiles] = useState<File[] | null>(null);
	const confirm = useConfirm();

	const dropZoneConfig = {
		maxFiles: 1,
		maxSize: 1024 * 1024 * 4,
		accept: {
			"image/jpeg": ["jpg", "jpeg"],
			"image/png": ["png"],
		},
	};
	const form = useForm<z.infer<typeof userInfoShema>>({
		resolver: zodResolver(userInfoShema),
		defaultValues: {
			name: props.user.name,
			isPrivate: props.user.isPrivate,
			image: props.user.image || "",
			bio: props.user.bio || "",
			location: props.user.location || "",
			website: props.user.website || "",
			phone: props.user.phone || "",
			callsign: props.user.callsign || "",
			email: props.user.email || "",
		},
	});

	async function onSubmit(values: z.infer<typeof userInfoShema>) {
		setIsLoading(true);
		try {
			if (files && files.length > 0) {
				const resp = await getUserImageUploadUrl({
					file: {
						type: files[0].type,
						size: files[0].size,
					},
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

				values.image = resp.data.cdnUrl;
			}

			await saveUserInformation(values);

			setFiles([]);

			toast.success("Podataci o korisniku su spašeni");
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
								Ime korisnika* ({form.watch("name")?.length}/
								{userInfoShema.shape.name.maxLength})
							</FormLabel>
							<FormControl>
								<Input placeholder="ASK Veis" type="text" {...field} />
							</FormControl>
							<FormDescription>Vaše ime</FormDescription>
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
							<FormDescription>Gdje se nalazite?</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="bio"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								Opis* ({form.watch("bio")?.length}/
								{userInfoShema.shape.bio.maxLength})
							</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Igram airsoft već 5 godina..."
									{...field}
								/>
							</FormControl>
							<FormDescription>
								Ovo je vaša prilika da se istaknete.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Email*</FormLabel>
							<FormControl>
								<Input placeholder="me@gmail.com" type="email" {...field} />
							</FormControl>
							<FormDescription>Vaš email</FormDescription>
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
								<FormLabel>Privatni profil*</FormLabel>
								<FormDescription>
									Sakrijte profil od javnog pristupa. Preporučujemo da ostavite
									profil javnim.
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
					name="image"
					render={() => (
						<FormItem>
							<FormLabel>Profilna slika</FormLabel>
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
								Preporučujemo da postavite profilnu sliku.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{props.user.image && (
					<HoverCard openDelay={100}>
						<HoverCardTrigger>
							<Button
								type="button"
								disabled={isDeletingImage}
								variant={"destructive"}
								onClick={async () => {
									const resp = await confirm({
										title: "Jeste li sigurni?",
										body: "Da li ste sigurni da želite obrisati profilnu sliku?",
										actionButtonVariant: "destructive",
										actionButton: "Obriši profilnu sliku",
										cancelButton: "Ne, vrati se",
									});

									if (!resp) {
										return;
									}

									setIsDeletingImage(true);
									await deleteUserImage();
									setIsDeletingImage(false);
								}}
								className="mt-1"
							>
								<Trash className="size-4" />
								{isDeletingImage ? (
									<Loader className="size-5 animate-spin" />
								) : (
									"Obriši profilnu sliku"
								)}
							</Button>
						</HoverCardTrigger>
						<HoverCardContent className="size-full mb-8">
							<Image
								src={`${props.user.image}?v=${props.user.updatedAt}`}
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
					name="phone"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Telefon</FormLabel>
							<FormControl>
								<PhoneInput
									defaultCountry="BA"
									placeholder="061 123 456"
									{...field}
								/>
							</FormControl>
							<FormDescription>Broj telefona</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="website"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Web stranica</FormLabel>
							<FormControl>
								<Input placeholder="https://google.com" {...field} />
							</FormControl>
							<FormDescription>Web stranica</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="callsign"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Pozivni znak</FormLabel>
							<FormControl>
								<Input placeholder="Veis" {...field} />
							</FormControl>
							<FormDescription>Pozivni znak</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<LoaderSubmitButton isLoading={isLoading}>Spasi</LoaderSubmitButton>
			</form>
		</Form>
	);
}
