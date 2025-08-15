"use client";
import type { User } from "@generated/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader, Phone, Shield, User as UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
	getUserImageUploadUrl,
	saveUserInformation,
} from "@/app/[locale]/dashboard/(user)/user/settings/_components/user-info.action";
import { userInfoShema } from "@/app/[locale]/dashboard/(user)/user/settings/_components/user-info.schema";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { SlugInput } from "@/components/slug/slug-input";
import { FileUpload, type FileUploadItem } from "@/components/ui/file-upload";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ImageCropDialog } from "./image-crop-dialog.tsx";

interface UserInfoFormProps {
	user: User | null;
}

export function UserInfoForm(props: UserInfoFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [isSlugValid, setIsSlugValid] = useState(true);
	const [cropFile, setCropFile] = useState<File | null>(null);
	const t = useTranslations("dashboard.user.settings");
	const { setHasUnsavedChanges } = useUnsavedChanges();

	// Initialize file upload system for avatar
	const initialFiles: FileUploadItem[] = props.user?.image
		? [
				{
					id: `existing-${props.user.id}`,
					url: props.user.image,
					name: "User avatar",
					type: "image/jpeg",
					isExisting: true,
				},
			]
		: [];

	const avatarUpload = useFileUpload({
		uploadFunction: async (file: File) => {
			const resp = await getUserImageUploadUrl({
				file: {
					type: file.type,
					size: file.size,
					dimensions: {
						width: 100,
						height: 100,
					},
				},
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

	const form = useForm<z.infer<typeof userInfoShema>>({
		resolver: zodResolver(userInfoShema),
		defaultValues: {
			name: props.user?.name || "",
			bio: props.user?.bio || "",
			location: props.user?.location || "",
			website: props.user?.website || "",
			phone: props.user?.phone || "",
			callsign: props.user?.callsign || "",
			isPrivate: props.user?.isPrivate || false,
			isPrivateEmail: props.user?.isPrivateEmail || false,
			isPrivatePhone: props.user?.isPrivatePhone || false,
			isPrivateStats: props.user?.isPrivateStats || false,
			slug: props.user?.slug || "",
		},
		mode: "onChange",
	});

	const handleCrop = (croppedFile: File) => {
		// Replace the current file with the cropped version
		const newFile: FileUploadItem = {
			id: `cropped-${Date.now()}`,
			file: croppedFile,
			name: croppedFile.name,
			type: croppedFile.type,
			size: croppedFile.size,
			isExisting: false,
		};
		avatarUpload.setFiles([newFile]);
		setCropFile(null);
	};

	const handleCloseCrop = () => {
		setCropFile(null);
	};

	async function onSubmit(values: z.infer<typeof userInfoShema>) {
		setIsLoading(true);
		try {
			// Upload avatar and handle deletion
			const uploadedUrls = await avatarUpload.uploadAllFiles();
			values.image = uploadedUrls.length > 0 ? uploadedUrls[0] : undefined;

			const result = await saveUserInformation(values);

			if (result?.data) {
				avatarUpload.markAsSaved();
				setHasUnsavedChanges(false);
				toast.success(t("success"));
			}
		} catch (error) {
			toast.error(t("error"));
		}
		setIsLoading(false);
	}

	return (
		<>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
					<div>
						<h3 className="text-lg font-semibold flex items-center gap-2">
							<UserIcon className="h-5 w-5" />
							{t("general")}
						</h3>
					</div>

					<FormField
						control={form.control}
						name="image"
						render={() => (
							<FormItem>
								<FormLabel>{t("avatar")}</FormLabel>
								<FormControl>
									<FileUpload
										value={avatarUpload.files}
										onChange={(files) => {
											if (files.length > 0 && files[0]?.file) {
												// Open crop dialog for new image files
												setCropFile(files[0].file);
											} else {
												avatarUpload.setFiles(files);
											}
										}}
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
								<FormDescription>{t("avatarDescription")}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("name")}</FormLabel>
								<FormControl>
									<Input placeholder={t("name")} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="slug"
						render={({ field }) => (
							<SlugInput
								currentSlug={props.user?.slug}
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
								<FormLabel>{t("bio")}</FormLabel>
								<FormControl>
									<Textarea placeholder={t("bioPlaceholder")} className="resize-none" {...field} />
								</FormControl>
								<FormDescription>{t("bioDescription")}</FormDescription>
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
									<Input placeholder={t("callsignPlaceholder")} {...field} />
								</FormControl>
								<FormDescription>{t("callsignDescription")}</FormDescription>
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
									<Input placeholder={t("locationPlaceholder")} {...field} />
								</FormControl>
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
								<FormMessage />
							</FormItem>
						)}
					/>

					<div>
						<h3 className="text-lg font-semibold flex items-center gap-2">
							<Phone className="h-5 w-5" />
							{t("contact")}
						</h3>
					</div>

					<FormField
						control={form.control}
						name="phone"
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

					<div>
						<h3 className="text-lg font-semibold flex items-center gap-2">
							<Shield className="h-5 w-5" />
							{t("privacy")}
						</h3>
					</div>

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
						name="isPrivateEmail"
						render={({ field }) => (
							<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
								<div className="space-y-0.5">
									<FormLabel>{t("privateEmail")}</FormLabel>
									<FormDescription>{t("privateEmailDescription")}</FormDescription>
								</div>
								<FormControl>
									<Switch checked={field.value} onCheckedChange={field.onChange} />
								</FormControl>
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="isPrivatePhone"
						render={({ field }) => (
							<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
								<div className="space-y-0.5">
									<FormLabel>{t("privatePhone")}</FormLabel>
									<FormDescription>{t("privatePhoneDescription")}</FormDescription>
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

					<LoaderSubmitButton isLoading={isLoading} disabled={!isSlugValid && !!form.watch("slug")}>
						{isLoading ? (
							<>
								<Loader className="mr-2 h-4 w-4 animate-spin" />
								{t("saving")}
							</>
						) : (
							t("save")
						)}
					</LoaderSubmitButton>
				</form>
			</Form>

			<ImageCropDialog file={cropFile} onClose={handleCloseCrop} onCrop={handleCrop} />
		</>
	);
}
