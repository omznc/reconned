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
	getUserHeaderImageUploadUrl,
	getUserImageUploadUrl,
	saveUserInformation,
} from "@/app/[locale]/dashboard/(user)/user/settings/_components/user-info.action";
import { userInfoShema } from "@/app/[locale]/dashboard/(user)/user/settings/_components/user-info.schema";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { SlugInput } from "@/components/slug/slug-input";
import type { FileUploadItem } from "@/components/ui/file-upload";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SingleImageUpload } from "@/components/ui/single-image-upload";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ImageCropDialog } from "./image-crop-dialog.tsx";

interface UserInfoFormProps {
	user: User | null;
}

export function UserInfoForm(props: UserInfoFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [isSlugValid, setIsSlugValid] = useState(true);
	const [cropFile, setCropFile] = useState<File | null>(null);
	const t = useTranslations();

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

	// Initialize file upload system for header image
	const initialHeaderFiles: FileUploadItem[] = props.user?.headerImage
		? [
				{
					id: `existing-header-${props.user.id}`,
					url: props.user.headerImage,
					name: "User header image",
					type: "image/jpeg",
					isExisting: true,
				},
			]
		: [];

	const headerUpload = useFileUpload({
		uploadFunction: async (file: File) => {
			const resp = await getUserHeaderImageUploadUrl({
				file: {
					type: file.type,
					size: file.size,
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
		initialFiles: initialHeaderFiles,
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
			headerImage: props.user?.headerImage || undefined,
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

			// Upload header image and handle deletion
			const uploadedHeaderUrls = await headerUpload.uploadAllFiles();
			values.headerImage = uploadedHeaderUrls.length > 0 ? uploadedHeaderUrls[0] : undefined;

			const result = await saveUserInformation(values);

			if (result?.data) {
				avatarUpload.markAsSaved();
				headerUpload.markAsSaved();
				form.reset(values);
				toast.success(t("dashboard.user.settings.success"));
			}
		} catch {
			toast.error(t("dashboard.user.settings.error"));
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
							{t("dashboard.user.settings.general")}
						</h3>
					</div>

					<FormField
						control={form.control}
						name="headerImage"
						render={() => (
							<FormItem>
								<FormLabel>{t("dashboard.user.settings.headerImage")}</FormLabel>
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
								<FormDescription>{t("dashboard.user.settings.headerImageDescription")}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="image"
						render={() => (
							<FormItem>
								<FormLabel>{t("dashboard.user.settings.avatar")}</FormLabel>
								<FormControl>
									<SingleImageUpload
										variant="avatar"
										value={avatarUpload.files}
										onChange={(files) => {
											if (files.length > 0 && files[0]?.file) {
												setCropFile(files[0].file);
											} else {
												avatarUpload.setFiles(files);
											}
										}}
										maxFileSize={4 * 1024 * 1024}
										accept={{
											"image/jpeg": [".jpg", ".jpeg"],
											"image/png": [".png"],
											"image/webp": [".webp"],
										}}
									/>
								</FormControl>
								<FormDescription>{t("dashboard.user.settings.avatarDescription")}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("dashboard.user.settings.name")}</FormLabel>
								<FormControl>
									<Input placeholder={t("dashboard.user.settings.name")} {...field} />
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
								<FormLabel>{t("dashboard.user.settings.bio")}</FormLabel>
								<FormControl>
									<Textarea
										placeholder={t("dashboard.user.settings.bioPlaceholder")}
										className="resize-none"
										{...field}
									/>
								</FormControl>
								<FormDescription>{t("dashboard.user.settings.bioDescription")}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="callsign"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("dashboard.user.settings.callsign")}</FormLabel>
								<FormControl>
									<Input placeholder={t("dashboard.user.settings.callsignPlaceholder")} {...field} />
								</FormControl>
								<FormDescription>{t("dashboard.user.settings.callsignDescription")}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="location"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("dashboard.user.settings.location")}</FormLabel>
								<FormControl>
									<Input placeholder={t("dashboard.user.settings.locationPlaceholder")} {...field} />
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
								<FormLabel>{t("dashboard.user.settings.website")}</FormLabel>
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
							{t("dashboard.user.settings.contact")}
						</h3>
					</div>

					<FormField
						control={form.control}
						name="phone"
						render={({ field }) => (
							<FormItem className="flex flex-col items-start">
								<FormLabel>{t("dashboard.user.settings.phone")}</FormLabel>
								<FormControl className="w-full">
									<PhoneInput placeholder="063 000 000" {...field} defaultCountry="BA" />
								</FormControl>
								<FormDescription>{t("dashboard.user.settings.phoneDescription")}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div>
						<h3 className="text-lg font-semibold flex items-center gap-2">
							<Shield className="h-5 w-5" />
							{t("dashboard.user.settings.privacy")}
						</h3>
					</div>

					<FormField
						control={form.control}
						name="isPrivate"
						render={({ field }) => (
							<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
								<div className="space-y-0.5">
									<FormLabel>{t("dashboard.user.settings.private")}</FormLabel>
									<FormDescription>{t("dashboard.user.settings.privateDescription")}</FormDescription>
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
									<FormLabel>{t("dashboard.user.settings.privateEmail")}</FormLabel>
									<FormDescription>
										{t("dashboard.user.settings.privateEmailDescription")}
									</FormDescription>
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
									<FormLabel>{t("dashboard.user.settings.privatePhone")}</FormLabel>
									<FormDescription>
										{t("dashboard.user.settings.privatePhoneDescription")}
									</FormDescription>
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
									<FormLabel>{t("dashboard.user.settings.privateStats")}</FormLabel>
									<FormDescription>
										{t("dashboard.user.settings.privateStatsDescription")}
									</FormDescription>
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
								{t("common.actions.saving")}
							</>
						) : (
							t("common.actions.save")
						)}
					</LoaderSubmitButton>
				</form>
			</Form>

			<ImageCropDialog file={cropFile} onClose={handleCloseCrop} onCrop={handleCrop} />
		</>
	);
}
