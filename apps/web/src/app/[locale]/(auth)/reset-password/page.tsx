"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useExtracted, useLocale } from "next-intl";
import { useQueryState } from "nuqs";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { TurnstileWidget, type TurnstileWidgetRef } from "@/app/[locale]/(auth)/_components/turnstile-widget";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, redirect, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { env } from "@/lib/env";

export default function LoginPage() {
	const [token, _] = useQueryState("token");
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();
	const t = useExtracted();
	const locale = useLocale();
	const turnstileRef = useRef<TurnstileWidgetRef>(null);

	const resetPasswordSchema = z
		.object({
			password: z.string().min(6, t("That password is too short")),
			confirmPassword: z.string(),
			turnstileToken: z.string().min(1, t("Captcha error")),
		})
		.refine((data) => data.password === data.confirmPassword, {
			message: "Šifre se ne podudaraju.",
			path: ["confirmPassword"],
		});

	type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

	// Initialize react-hook-form
	const form = useForm<ResetPasswordFormValues>({
		resolver: zodResolver(resetPasswordSchema),
		defaultValues: {
			password: "",
			confirmPassword: "",
			turnstileToken: "",
		},
		mode: "onChange",
	});

	if (!token) {
		return redirect({ href: "/login", locale });
	}

	async function onSubmit(data: ResetPasswordFormValues) {
		const headers = new Headers();
		headers.append("x-captcha-response", data.turnstileToken);

		await authClient.resetPassword({
			newPassword: data.password,
			token: token || undefined,
			fetchOptions: {
				headers: headers,
				onRequest: () => {
					setIsLoading(true);
				},
				onResponse: () => {
					setIsLoading(false);
					// Reset Turnstile widget UI on response, don't clear token
					if (turnstileRef.current) {
						turnstileRef.current.reset();
					}
				},
				onSuccess: () => {
					toast.success(t("Password successfully reset. "));
					router.push("/login");
				},
				onError: (ctx) => {
					if (ctx.error.status === 403) {
						toast.error(t("An error occurred while resetting the password. "));
					} else {
						setIsError(true);
					}
				},
			},
		});
	}

	return (
		<>
			<CardHeader>
				<CardTitle className="text-2xl">{t("Reset password")}</CardTitle>
				<CardDescription>{t("Enter a new password to access your account.")}</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<Label htmlFor="password">{t("Password")}</Label>
									<FormControl>
										<Input {...field} id="password" type="password" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="confirmPassword"
							render={({ field }) => (
								<FormItem>
									<Label htmlFor="confirmPassword">{t("Confirm password")}</Label>
									<FormControl>
										<Input {...field} id="confirmPassword" type="password" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{isError && <p className="text-red-500 -mb-2">{t("The data entered is incorrect.")}</p>}

						<TurnstileWidget
							ref={turnstileRef}
							sitekey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
							onVerify={(token) => {
								// Only set if we have a valid token
								if (token && token.length > 0) {
									form.setValue("turnstileToken", token, { shouldValidate: true });
								}
							}}
						/>

						<LoaderSubmitButton isLoading={isLoading} className="w-full" disabled={!form.formState.isValid}>
							{t("Reset password")}
						</LoaderSubmitButton>
					</form>
				</Form>
				<div className="mt-4 text-center text-sm">
					{t("Don't have an account?")}{" "}
					<Link href="/register" className="underline">
						{t("Register")}
					</Link>
				</div>
			</CardContent>
		</>
	);
}
