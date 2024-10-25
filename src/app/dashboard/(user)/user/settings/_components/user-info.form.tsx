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
import { CloudUpload } from "lucide-react";

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

interface UserInfoFormProps {
	user: User;
}

// export const userInfoShema = z.object({
// 	name: z.string().min(1).max(50),
// 	email: z.string().email(),
// 	isPrivate: z.boolean(),
// 	image: z.string().optional(),
// 	bio: z.string().optional(),
// 	location: z.string().optional(),
// 	website: z.string().optional(),
// 	phone: z.string().optional(),
// 	callsign: z.string().optional(),
// 	gear: z
// 		.array(
// 			z.object({
// 				name: z.string(),
// 				energy: z.string(),
// 				fps: z.string(),
// 			}),
// 		)
// 		.optional(),
// 	id: z.string(),
// });

export function UserInfoForm(props: UserInfoFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [files, setFiles] = useState<File[] | null>(null);

	const dropZoneConfig = {
		maxFiles: 1,
		maxSize: 1024 * 1024 * 4,
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

				values.image = resp.data.url.split("?")[0];
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
					render={({ field }) => (
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
								Preporučujemo da postavite profilnu sliku.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{!props.user.image?.includes("default-user-image") && (
					<Button
						variant={"destructive"}
						onClick={async () => {
							await deleteUserImage();
						}}
					>
						Obriši trenutnu sliku
					</Button>
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
