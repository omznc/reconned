import { authClient } from "@auth/client";
import { Button } from "@components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@components/ui/form";
import { Input } from "@components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { LockIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Dispatch, SetStateAction } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { passwordChangeSchema } from "@/app/[locale]/dashboard/(user)/user/security/_components/password.schema";

export function PasswordChangeForm({
	isLoading,
	setIsLoading,
}: {
	isLoading: boolean;
	setIsLoading: Dispatch<SetStateAction<boolean>>;
}) {
	const t = useTranslations();
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
					onError: () => {
						setIsLoading(false);
						toast.error(t("dashboard.security.passwordChange.error"));
					},
					onSuccess: () => {
						setIsLoading(false);
						toast.success(t("dashboard.security.passwordChange.success"));
					},
				},
			);
			changePasswordForm.reset();
		} catch (_e) {
			toast(t("dashboard.security.passwordChange.error"));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Form {...changePasswordForm}>
			<form onSubmit={changePasswordForm.handleSubmit(onChangePasswordSubmit)} className="space-y-4 w-full">
				<div>
					<h3 className="text-lg font-semibold">{t("dashboard.security.passwordChange.title")}</h3>
				</div>
				<FormField
					control={changePasswordForm.control}
					name="currentPassword"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("dashboard.security.passwordChange.currentPassword")}</FormLabel>
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
							<FormLabel>{t("dashboard.security.passwordChange.newPassword")}</FormLabel>
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
							<FormLabel>{t("dashboard.security.passwordChange.confirmPassword")}</FormLabel>
							<FormControl>
								<Input type="password" disabled={isLoading} {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit" className="w-full" disabled={isLoading}>
					<LockIcon className="w-4 h-4 mr-2" />
					{isLoading
						? t("dashboard.security.passwordChange.loading")
						: t("dashboard.security.passwordChange.changePassword")}
				</Button>
			</form>
		</Form>
	);
}
