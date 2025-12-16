"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader, Phone, Shield, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { userInfoShema } from "@/app/[locale]/dashboard/(user)/user/settings/_components/user-info.schema";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { SlugInput } from "@/components/slug/slug-input";
import { validateSlug } from "@/components/slug/validate-slug";
import type { FileUploadItem } from "@/components/ui/file-upload";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SingleImageUpload } from "@/components/ui/single-image-upload";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ActionError } from "@/lib/action-error";
import apiClient from "@/lib/api/api.client.ts";
import type { ApiResponse } from "@/lib/api/api-type-helpers.ts";
import { addImageVersion } from "@/lib/utils";
import { ImageCropDialog } from "./image-crop-dialog.tsx";

type User = ApiResponse<"/api/users/{id}", "get">;
interface UserInfoFormProps {
	user: User | null;
}

export function UserInfoForm(props: UserInfoFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [isSlugValid, setIsSlugValid] = useState(true);
	const [cropFile, setCropFile] = useState<File | null>(null);
	const t = useExtracted();
	const router = useRouter();

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
			if (!props.user?.id) {
				throw new ActionError("User not found");
			}

			const { data, error } = await apiClient.POST("/api/users/{id}/image/upload-url", {
				params: {
					path: {
						id: props.user.id,
					},
				},
				body: {
					type: file.type,
					size: file.size,
				},
			});

			if (error || !data?.url) {
				throw new ActionError("Failed to get upload URL");
			}

			await fetch(data.url, {
				method: "PUT",
				body: file,
				headers: {
					"Content-Type": file.type,
					"Content-Length": file.size.toString(),
				},
			});

			return data.cdnUrl;
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
			if (!props.user?.id) {
				throw new ActionError("User not found");
			}

			const { data, error } = await apiClient.POST("/api/users/{id}/header-image/upload-url", {
				params: {
					path: {
						id: props.user.id,
					},
				},
				body: {
					type: file.type,
					size: file.size,
				},
			});

			if (error || !data?.url) {
				throw new ActionError("Failed to get upload URL");
			}

			await fetch(data.url, {
				method: "PUT",
				body: file,
				headers: {
					"Content-Type": file.type,
					"Content-Length": file.size.toString(),
				},
			});

			return data.cdnUrl;
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
		if (!props.user?.id) {
			toast.error(t("User not found"));
			return;
		}

		setIsLoading(true);
		try {
			if (values.slug) {
				const valid = await validateSlug({
					type: "user",
					slug: values.slug,
				});
				if (!valid) {
					toast.error(t("Link taken"));
					setIsLoading(false);
					return;
				}
			}

			const uploadedUrls = await avatarUpload.uploadAllFiles();
			values.image = uploadedUrls.length > 0 ? uploadedUrls[0] : undefined;

			const uploadedHeaderUrls = await headerUpload.uploadAllFiles();
			values.headerImage = uploadedHeaderUrls.length > 0 ? uploadedHeaderUrls[0] : undefined;

			const shouldDeleteImage = values.image === undefined;
			const shouldDeleteHeaderImage = values.headerImage === undefined;

			const { error } = await apiClient.PUT("/api/users/{id}", {
				params: {
					path: {
						id: props.user.id,
					},
				},
				body: {
					name: values.name,
					bio: values.bio,
					website: values.website,
					location: values.location,
					phone: values.phone,
					slug: values.slug,
					callsign: values.callsign,
					isPrivate: values.isPrivate,
					isPrivateEmail: values.isPrivateEmail,
					isPrivatePhone: values.isPrivatePhone,
					isPrivateStats: values.isPrivateStats,
					image: values.image ? addImageVersion(values.image) : undefined,
					headerImage: values.headerImage ? addImageVersion(values.headerImage) : undefined,
				},
			});

			if (error) {
				toast.error(t("Failed to update user information"));
				setIsLoading(false);
				return;
			}

			if (shouldDeleteImage) {
				await apiClient.DELETE("/api/users/{id}/image", {
					params: {
						path: {
							id: props.user.id,
						},
					},
				});
			}

			if (shouldDeleteHeaderImage) {
				await apiClient.DELETE("/api/users/{id}/header-image", {
					params: {
						path: {
							id: props.user.id,
						},
					},
				});
			}

			avatarUpload.markAsSaved();
			headerUpload.markAsSaved();
			form.reset(values);
			router.refresh();
			toast.success(t("User data has been saved"));
		} catch {
			toast.error(t("An error occurred while saving data"));
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
							{t("General")}
						</h3>
					</div>

					<FormField
						control={form.control}
						name="headerImage"
						render={() => (
							<FormItem>
								<FormLabel>{t("Header image")}</FormLabel>
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
								<FormDescription>
									{t("Add a wide cover photo to personalize your profile (1200x300).")}
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="image"
						render={() => (
							<FormItem>
								<FormLabel>{t("Profile picture")}</FormLabel>
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
								<FormDescription>
									{t("We recommend that you upload a profile picture.")}
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("Your name")}</FormLabel>
								<FormControl>
									<Input placeholder={t("Your name")} {...field} />
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
								<FormLabel>{t("About you")}</FormLabel>
								<FormControl>
									<Textarea
										placeholder={t("Something about me is that...")}
										className="resize-none"
										{...field}
									/>
								</FormControl>
								<FormDescription>
									{t("This is your chance to stand out in a few sentences")}
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="callsign"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("Callsign")}</FormLabel>
								<FormControl>
									<Input placeholder={t("My callsign")} {...field} />
								</FormControl>
								<FormDescription>{t("Callsign you use on the field")}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="location"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("Location")}</FormLabel>
								<FormControl>
									<Input placeholder={t("Sarajevo, BiH")} {...field} />
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
								<FormLabel>{t("Website")}</FormLabel>
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
							{t("Contact")}
						</h3>
					</div>

					<FormField
						control={form.control}
						name="phone"
						render={({ field }) => (
							<FormItem className="flex flex-col items-start">
								<FormLabel>{t("Phone number")}</FormLabel>
								<FormControl className="w-full">
									<PhoneInput placeholder="063 000 000" {...field} defaultCountry="BA" />
								</FormControl>
								<FormDescription>{t("This is how people can reach you")}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div>
						<h3 className="text-lg font-semibold flex items-center gap-2">
							<Shield className="h-5 w-5" />
							{t("Privacy")}
						</h3>
					</div>

					<FormField
						control={form.control}
						name="isPrivate"
						render={({ field }) => (
							<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
								<div className="space-y-0.5">
									<FormLabel>{t("Private profile")}</FormLabel>
									<FormDescription>
										{t("Hide profile from public access. We recommend keeping profile public.")}
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
						name="isPrivateEmail"
						render={({ field }) => (
							<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
								<div className="space-y-0.5">
									<FormLabel>{t("Private email")}</FormLabel>
									<FormDescription>{t("Hide your email address from public access")}</FormDescription>
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
									<FormLabel>{t("Private phone")}</FormLabel>
									<FormDescription>{t("Hide your phone number from public access")}</FormDescription>
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
									<FormLabel>{t("Private Statistics")}</FormLabel>
									<FormDescription>
										{t("Only you can see how many views your profile has")}
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
								{t("Saving...")}
							</>
						) : (
							t("Save")
						)}
					</LoaderSubmitButton>
				</form>
			</Form>

			<ImageCropDialog file={cropFile} onClose={handleCloseCrop} onCrop={handleCrop} />
		</>
	);
}
