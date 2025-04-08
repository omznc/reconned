"use client";

import { GoogleLoginButton } from "@/app/[locale]/(auth)/_components/google-login-button";
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
import { Button } from "@components/ui/button";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { Key } from "lucide-react";
import type { SuccessContext } from "better-auth/react";
import { BadgeSoon } from "@/components/badge-soon";
import { useTranslations } from "next-intl";
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
	const [isLoading, setIsLoading] = useState(false);
	const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();
	const t = useTranslations("public.auth");
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
	const turnstileRef = useRef<TurnstileWidgetRef>(null);
	const [email, setEmail] = useQueryState("email", {
		defaultValue: "",
		clearOnDefault: true,
		shallow: true,
	});

	const [redirectTo] = useQueryState("redirectTo");
	const [message, setMessage] = useQueryState("message");

	// Login form schema with Zod
	const loginSchema = z.object({
		email: z.string().email(t("invalidEmail")),
		password: z.string().min(1, t("passwordRequired")),
	});

	type LoginFormValues = z.infer<typeof loginSchema>;

	// Initialize react-hook-form
	const form = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: email || "",
			password: "",
		},
		mode: "onChange",
	});

	useEffect(() => {
		if (message) {
			toast.info(decodeURIComponent(message));
			setMessage(null, { shallow: true });
		}
		authClient.oneTap();
	}, [message, setMessage]);

	function handleSuccessfulLogin(
		// biome-ignore lint/suspicious/noExplicitAny: It's not typed.
		context: SuccessContext<any>,
	): void | Promise<void> {
		if (context.data.twoFactorRedirect) {
			router.push("/two-factor");
			return;
		}
		router.push(redirectTo ? redirectTo : "/");
		router.refresh();
	}

	async function onSubmit(data: LoginFormValues) {
		if (!turnstileToken) {
			toast.error(t("captchaError"));
			return;
		}

		const headers = new Headers();
		headers.append("x-captcha-response", turnstileToken);

		await authClient.signIn.email({
			email: data.email,
			password: data.password,
			fetchOptions: {
				headers: headers,
				onRequest: () => {
					setIsLoading(true);
				},
				onResponse: () => {
					setIsLoading(false);
					// Only reset widget UI, don't clear token state on errors
					if (turnstileRef.current) {
						turnstileRef.current.reset();
					}
				},
				onSuccess: handleSuccessfulLogin,
				onError: (ctx) => {
					if (ctx.error.status === 403) {
						toast.error(t("unverified"));
					} else {
						if (ctx.error.message === "Missing CAPTCHA response") {
							toast.error(t("captchaError"));
							router.refresh();
						}
						setIsError(true);
					}
				},
			},
		});
	}

	// Debug the token state to see when it changes
	useEffect(() => {
		console.log(
			"Turnstile token state changed:",
			turnstileToken ? "token set" : "no token",
		);
	}, [turnstileToken]);

	return (
		<>
			<CardHeader>
				<CardTitle className="text-2xl">{t("login")}</CardTitle>
				<CardDescription>{t("loginDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<Label htmlFor="email">Email</Label>
									<FormControl>
										<Input
											{...field}
											id="email"
											type="email"
											placeholder="mail@example.com"
											autoComplete="email webauthn"
											suppressHydrationWarning
										/>
									</FormControl>
									{!!email && (
										<p className="text-sm text-gray-500">
											{t("emailAutofilled")}{" "}
											<span
												className="text-foreground cursor-pointer inline"
												onClick={() => {
													setEmail("");
												}}
											>
												{t("remove")}
											</span>
										</p>
									)}
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<div className="flex items-center">
										<Label htmlFor="password">{t("password")}</Label>
										<Button
											type="button"
											onClick={async () => {
												if (isForgotPasswordLoading) {
													return;
												}
												setIsForgotPasswordLoading(true);
												const email = form.getValues("email");
												if (!email) {
													toast.error(t("forgotPasswordNoEmail"));
													setIsForgotPasswordLoading(false);
													return;
												}

												if (
													!form.formState.dirtyFields.email ||
													form.getFieldState("email").invalid
												) {
													toast.error(t("forgotPasswordWrongEmail"));
													setIsForgotPasswordLoading(false);
													return;
												}

												await authClient.forgetPassword({
													email,
													redirectTo: "/reset-password",
												});
												toast.success(t("forgotPasswordSuccess"));
												setIsForgotPasswordLoading(false);
											}}
											variant="ghost"
											className="ml-auto inline-block text-sm underline plausible-event-name=forgot-password-click"
											disabled={isLoading || isForgotPasswordLoading}
										>
											{isForgotPasswordLoading
												? t("loading")
												: t("forgotPassword")}
										</Button>
									</div>
									<FormControl>
										<Input
											{...field}
											id="password"
											type="password"
											autoComplete="current-password webauthn"
										/>
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
								if (token && token.length > 0) {
									setTurnstileToken(token);
								}
							}}
						/>

						<LoaderSubmitButton
							isLoading={isLoading}
							disabled={
								isForgotPasswordLoading ||
								!turnstileToken ||
								!form.formState.isValid
							}
							className="w-full plausible-event-name=login-button-click"
						>
							{t("login")}
						</LoaderSubmitButton>

						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								className="w-full"
								disabled={isLoading || true}
								type="button"
								onClick={async () => {
									await authClient.signIn.passkey(
										{},
										{
											onRequest: () => {
												setIsLoading(true);
											},
											onResponse: () => {
												setIsLoading(false);
											},
											onSuccess: handleSuccessfulLogin,
											onError: () => {
												setIsError(true);
											},
										},
									);
								}}
							>
								<Key className="w-4 h-4 inline-block" /> Passkey
								<BadgeSoon />
							</Button>
							<GoogleLoginButton
								turnstileToken={turnstileToken}
								isLoading={isLoading}
								redirectTo={redirectTo}
							/>
						</div>
					</form>
				</Form>
				<div className="mt-4 text-center text-sm">
					{t("noAccountQuestion")}{" "}
					<Link
						href={
							redirectTo
								? `/register?redirectTo=${encodeURIComponent(redirectTo)}`
								: "/register"
						}
						className="underline"
					>
						{t("register")}
					</Link>
				</div>
			</CardContent>
		</>
	);
}
