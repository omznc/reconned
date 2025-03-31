"use client";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useLocale, useTranslations } from "next-intl";
import { Link, redirect } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useQueryState } from "nuqs";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
	TurnstileWidget,
	type TurnstileWidgetRef,
} from "@/app/[locale]/(auth)/_components/turnstile-widget";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@/components/ui/form";

export default function LoginPage() {
	const [token, _] = useQueryState("token");
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();
	const t = useTranslations("public.auth");
	const locale = useLocale();
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
	const turnstileRef = useRef<TurnstileWidgetRef>(null);

	// Reset password form schema with Zod
	const resetPasswordSchema = z
		.object({
			password: z.string().min(6, t("passwordTooShort")),
			confirmPassword: z.string(),
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
		},
		mode: "onChange",
	});

	if (!token) {
		return redirect({ href: "/login", locale });
	}

	async function onSubmit(data: ResetPasswordFormValues) {
		if (!turnstileToken) {
			toast.error(t("captchaError"));
			console.error("Missing turnstile token on reset password submit");
			return;
		}

		// Create headers with the token
		const headers = new Headers();
		headers.append("x-captcha-response", turnstileToken);

		await authClient.resetPassword(
			{
				newPassword: data.password,
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
						toast.success(t("resetPasswordSuccess"));
						router.push("/login");
					},
					onError: (ctx) => {
						console.error("Reset password error:", ctx.error);
						if (ctx.error.status === 403) {
							toast.error(t("resetPasswordError"));
						} else {
							setIsError(true);
						}
					},
				},
			},
		);
	}

	return (
		<>
			<CardHeader>
				<CardTitle className="text-2xl">{t("resetPassword")}</CardTitle>
				<CardDescription>{t("resetPasswordDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<Label htmlFor="password">{t("password")}</Label>
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
									<Label htmlFor="confirmPassword">
										{t("confirmPassword")}
									</Label>
									<FormControl>
										<Input {...field} id="confirmPassword" type="password" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{isError && (
							<p className="text-red-500 -mb-2">{t("invalidData")}</p>
						)}

						<TurnstileWidget
							ref={turnstileRef}
							onVerify={(token) => {
								// Only set if we have a valid token
								if (token && token.length > 0) {
									setTurnstileToken(token);
								}
							}}
						/>

						<LoaderSubmitButton
							isLoading={isLoading}
							className="w-full"
							disabled={!(turnstileToken && form.formState.isValid)}
						>
							{t("resetPassword")}
						</LoaderSubmitButton>
					</form>
				</Form>
				<div className="mt-4 text-center text-sm">
					{t("noAccountQuestion")}{" "}
					<Link href="/register" className="underline">
						{t("register")}
					</Link>
				</div>
			</CardContent>
		</>
	);
}
