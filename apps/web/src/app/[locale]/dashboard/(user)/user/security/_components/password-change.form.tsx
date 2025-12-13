import { authClient } from "@auth/client";
import { Button } from "@components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@components/ui/form";
import { Input } from "@components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { LockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import type { Dispatch, SetStateAction } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

export function PasswordChangeForm({
	isLoading,
	setIsLoading,
}: {
	isLoading: boolean;
	setIsLoading: Dispatch<SetStateAction<boolean>>;
}) {
	const t = useExtracted();

	const passwordChangeSchema = z
		.object({
			currentPassword: z.string().min(1, t("You must enter your current password")),
			confirmPassword: z.string().min(1, t("You must enter your new password")),
			newPassword: z.string().min(8, t("New password must be at least 8 characters long")),
		})
		.refine((data) => data.newPassword === data.confirmPassword, {
			message: t("Passwords do not match"),
			path: ["confirmPassword"],
		});

	const changePasswordForm = useForm<z.infer<typeof passwordChangeSchema>>({
		resolver: zodResolver(passwordChangeSchema),
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
	});

	const onChangePasswordSubmit = async (values: z.infer<typeof passwordChangeSchema>) => {
		setIsLoading(true);
		try {
			await authClient.changePassword(
				{
					currentPassword: values.currentPassword,
					newPassword: values.newPassword,
				},
				{
					onRequest: () => {
						setIsLoading(true);
					},
					onError: (e) => {
						setIsLoading(false);
						if (e.error?.code === "INVALID_PASSWORD") {
							toast.error(t("Please enter the correct password"));
							return;
						}
						toast.error(t("An error occurred while changing your password. "));
					},
					onSuccess: () => {
						setIsLoading(false);
						toast.success(t("Password successfully changed"));
					},
				},
			);
			changePasswordForm.reset();
		} catch (_e) {
			toast(t("An error occurred while changing your password. "));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Form {...changePasswordForm}>
			<form onSubmit={changePasswordForm.handleSubmit(onChangePasswordSubmit)} className="space-y-4 w-full">
				<div>
					<h3 className="text-lg font-semibold">{t("Change password")}</h3>
				</div>
				<FormField
					control={changePasswordForm.control}
					name="currentPassword"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("Current password")}</FormLabel>
							<FormControl>
								<Input type="password" disabled={isLoading} {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={changePasswordForm.control}
					name="newPassword"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("New password")}</FormLabel>
							<FormControl>
								<Input type="password" disabled={isLoading} {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={changePasswordForm.control}
					name="confirmPassword"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("Confirm new password")}</FormLabel>
							<FormControl>
								<Input type="password" disabled={isLoading} {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit" className="w-full" disabled={isLoading}>
					<LockIcon className="w-4 h-4 mr-2" />
					{isLoading ? t("Just a moment...") : t("Change password")}
				</Button>
			</form>
		</Form>
	);
}
