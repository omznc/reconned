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
import { userInfoShema } from "@/app/[locale]/dashboard/(user)/user/settings/_components/user-info.schema";
import {
	deleteUserImage,
	getUserImageUploadUrl,
	saveUserInformation,
} from "@/app/[locale]/dashboard/(user)/user/settings/_components/user-info.action";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
	HoverCard,
	HoverCardTrigger,
	HoverCardContent,
} from "@/components/ui/hover-card";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { SlugInput } from "@/components/slug/slug-input";
import { ImageCropDialog } from "@/app/[locale]/dashboard/(user)/user/settings/_components/image-crop-dialog";
import type { DropzoneOptions } from "react-dropzone";
import { useTranslations } from "next-intl";

interface UserInfoFormProps {
	user: User;
}

export function UserInfoForm(props: UserInfoFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [isDeletingImage, setIsDeletingImage] = useState(false);
	const [files, setFiles] = useState<File[] | null>(null);
	const [isSlugValid, setIsSlugValid] = useState(true);
	const [cropFile, setCropFile] = useState<File | null>(null);
	const confirm = useConfirm();
	const t = useTranslations("dashboard.user.settings");

	const dropZoneConfig = {
		maxFiles: 1,
		maxSize: 1024 * 1024 * 4,
		accept: {
			"image/jpeg": ["jpg", "jpeg"],
			"image/png": ["png"],
		},
	} satisfies DropzoneOptions;
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
			slug: props.user.slug || "",
			isPrivateEmail: props.user.isPrivateEmail,
			isPrivatePhone: props.user.isPrivatePhone,
		},
	});

	async function onSubmit(values: z.infer<typeof userInfoShema>) {
		setIsLoading(true);
		try {
			if (files?.[0]) {
				const img = await createImageBitmap(files[0]);
				const resp = await getUserImageUploadUrl({
					file: {
						type: files[0].type,
						size: files[0].size,
						dimensions: {
							width: img.width,
							height: img.height,
						},
					},
				});

				if (!resp?.data?.url) {
					toast.error(t("imageUploadError"));
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

			toast.success(t("profileUpdated"));
		} catch (_error) {
			toast.error(t("profileUpdateError"));
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
					<h3 className="text-lg font-semibold">{t("title")}</h3>
				</div>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								{t("name")}* ({form.watch("name")?.length}/
								{userInfoShema.shape.name.maxLength})
							</FormLabel>
							<FormControl>
								<Input placeholder="Veis" type="text" {...field} />
							</FormControl>
							<FormDescription>{t("name")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="callsign"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("callsign")}</FormLabel>
							<FormControl>
								<Input placeholder="Ninja" {...field} />
							</FormControl>
							<FormDescription>{t("callsign")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="location"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("location")}</FormLabel>
							<FormControl>
								<Input placeholder="Livno" type="text" {...field} />
							</FormControl>
							<FormDescription>{t("locationDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="slug"
					render={({ field }) => (
						<SlugInput
							currentSlug={props.user.slug}
							defaultSlug={field.value}
							type="user"
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
					name="bio"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								{t("bio")} ({form.watch("bio")?.length}/
								{userInfoShema.shape.bio.maxLength})
							</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Igram airsoft već 5 godina..."
									className="h-[144px] min-h-[144px] max-h-[144px]"
									{...field}
								/>
							</FormControl>
							<FormDescription>{t("bioDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<div className="flex justify-between items-center">
								<FormLabel>Email*</FormLabel>
								<FormField
									control={form.control}
									name="isPrivateEmail"
									render={({ field: privateField }) => (
										<div className="flex items-center gap-2">
											<FormLabel className="text-sm text-muted-foreground">
												{privateField.value ? t("private") : t("public")}
											</FormLabel>
											<Switch
												checked={privateField.value}
												onCheckedChange={privateField.onChange}
											/>
										</div>
									)}
								/>
							</div>
							<FormControl>
								<Input
									disabled={true}
									placeholder="me@gmail.com"
									type="email"
									{...field}
								/>
							</FormControl>
							<FormDescription>Email</FormDescription>
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
								<div className="flex items-center gap-2">
									<FormLabel>{t("privateProfile")}</FormLabel>
									<span className="text-sm text-muted-foreground">
										{field.value ? t("private") : t("public")}
									</span>
								</div>
								<FormDescription>
									{t("privateProfileDescription")}
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
							<FormLabel>{t("profilePhoto")}</FormLabel>
							<FormControl>
								<FileUploader
									key={`file-uploader-${files?.length}-${files?.[0]?.name}`}
									value={files}
									onValueChange={(newFiles) => {
										if (!newFiles || newFiles.length === 0) {
											setFiles(null);
											setCropFile(null);
										} else if (newFiles[0]) {
											setCropFile(newFiles[0]);
										}
									}}
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
							<FormDescription>{t("profilePhotoDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<ImageCropDialog
					file={cropFile}
					onClose={() => setCropFile(null)}
					onCrop={(croppedFile) => {
						setFiles([croppedFile]);
						setCropFile(null);
					}}
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
										title: t("deleteProfilePhoto.title"),
										body: t("deleteProfilePhoto.body"),
										actionButtonVariant: "destructive",
										actionButton: t("deleteProfilePhoto.confirm"),
										cancelButton: t("deleteProfilePhoto.cancel"),
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
									t("deleteProfilePhoto.confirm")
								)}
							</Button>
						</HoverCardTrigger>
						<HoverCardContent className="size-full mb-8">
							<Image
								src={props.user.image}
								alt="Club logo"
								width={200}
								height={200}
							/>
						</HoverCardContent>
					</HoverCard>
				)}

				<div className="mt-8">
					<h3 className="text-lg font-semibold">{t("contact")}</h3>
				</div>

				<FormField
					control={form.control}
					name="phone"
					render={({ field }) => (
						<FormItem>
							<div className="flex justify-between items-center">
								<FormLabel>{t("phone")}</FormLabel>
								<FormField
									control={form.control}
									name="isPrivatePhone"
									render={({ field: privateField }) => (
										<div className="flex items-center gap-2">
											<FormLabel className="text-sm text-muted-foreground">
												{privateField.value ? t("private") : t("public")}
											</FormLabel>
											<Switch
												checked={privateField.value}
												onCheckedChange={privateField.onChange}
											/>
										</div>
									)}
								/>
							</div>
							<FormControl>
								<PhoneInput
									defaultCountry="BA"
									placeholder="061 123 456"
									{...field}
								/>
							</FormControl>
							<FormDescription>{t("phone")}</FormDescription>
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
								<Input placeholder="https://google.com" {...field} />
							</FormControl>
							<FormDescription>{t("website")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<LoaderSubmitButton
					isLoading={isLoading}
					disabled={!isSlugValid && !!form.watch("slug")}
				>
					{t("save")}
				</LoaderSubmitButton>
			</form>
		</Form>
	);
}
