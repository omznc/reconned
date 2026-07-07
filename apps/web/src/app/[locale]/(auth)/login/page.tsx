"use client";

import { Button } from "@components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import type { SuccessContext } from "better-auth/react";
import { Key, MailIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import posthog from "posthog-js";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { GoogleLoginButton } from "@/app/[locale]/(auth)/_components/google-login-button";
import { TurnstileWidget, type TurnstileWidgetRef } from "@/app/[locale]/(auth)/_components/turnstile-widget";
import { Loader } from "@/components/loader";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

export default function LoginPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
	const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();
	const t = useExtracted();
	const turnstileRef = useRef<TurnstileWidgetRef>(null);
	const [email, setEmail] = useQueryState("email", {
		defaultValue: "",
		clearOnDefault: true,
		shallow: true,
	});
	const [redirectTo] = useQueryState("redirectTo");
	const [message, setMessage] = useQueryState("message");
	const [responseType] = useQueryState("response_type");
	const [lastMethod, setLastMethod] = useState<string | null>(null);
	const [mcpAuthorizeUrl, setMcpAuthorizeUrl] = useState<string | null>(null);

	useEffect(() => {
		if (responseType && !redirectTo) {
			setMcpAuthorizeUrl(`/api/auth/mcp/authorize${window.location.search}`);
		}
	}, [responseType, redirectTo]);

	const effectiveRedirectTo = mcpAuthorizeUrl || redirectTo;

	useEffect(() => {
		setLastMethod(authClient.getLastUsedLoginMethod());
	}, []);

	const loginSchema = z.object({
		email: z.string().email(t("Invalid email")),
		password: z.string().min(1, t("Your password is required")),
		turnstileToken: z.string().min(1, t("Captcha error")),
	});

	type LoginFormValues = z.infer<typeof loginSchema>;

	// Initialize react-hook-form
	const form = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: email || "",
			password: "",
			turnstileToken: "",
		},
		mode: "onChange",
	});

	useEffect(() => {
		if (message) {
			toast.info(decodeURIComponent(message));
			setMessage(null, { shallow: true });
		}
	}, [message, setMessage]);

	function handleSuccessfulLogin(
		// biome-ignore lint/suspicious/noExplicitAny: It's not typed.
		context: SuccessContext<any>,
	): void | Promise<void> {
		if (context.data.twoFactorRedirect) {
			router.push("/two-factor");
			return;
		}
		router.push(effectiveRedirectTo || "/");
		router.refresh();
	}

	async function onSubmit(data: LoginFormValues) {
		const headers = new Headers();
		headers.append("x-captcha-response", data.turnstileToken);

		// Track login attempt
		posthog.capture("user_login_attempt", {
			email: data.email,
			method: "email",
		});

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
						toast.error(t("Your email has not been verified. "));
					} else {
						if (ctx.error.message === "Missing CAPTCHA response") {
							toast.error(t("Captcha error"));
							router.refresh();
						}
						setIsError(true);
					}
				},
			},
		});
	}

	return (
		<>
			<h1 className="sr-only">{t("Login to RECONNED")}</h1>
			<CardHeader>
				<CardTitle className="text-2xl">{t("Login")}</CardTitle>
				<CardDescription>{t("Enter your email and password to join the world of airsoft.")}</CardDescription>
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
											maxLength={255}
											suppressHydrationWarning
										/>
									</FormControl>
									{!!email && (
										<p className="text-sm text-gray-500">
											{t("The email has been filled in automatically")}{" "}
											{/* biome-ignore lint/a11y/useSemanticElements: Style stuff */}
											<span
												role="button"
												tabIndex={0}
												className="text-foreground cursor-pointer inline"
												onClick={() => {
													setEmail("");
												}}
											>
												{t("Remove")}
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
										<Label htmlFor="password">{t("Password")}</Label>
										<Button
											type="button"
											onClick={async () => {
												if (isForgotPasswordLoading) {
													return;
												}
												setIsForgotPasswordLoading(true);
												const email = form.getValues("email");
												if (!email) {
													toast.error(
														t("Enter your email to receive a password reset link."),
													);
													setIsForgotPasswordLoading(false);
													return;
												}

												if (form.getFieldState("email").invalid) {
													toast.error(t("The email is not valid."));
													setIsForgotPasswordLoading(false);
													return;
												}

												await authClient.requestPasswordReset({
													email,
													redirectTo: "/reset-password",
												});
												toast.success(t("A password reset link has been sent to your email."));
												setIsForgotPasswordLoading(false);
											}}
											variant="ghost"
											className="ml-auto inline-block text-sm underline"
											disabled={isLoading || isForgotPasswordLoading}
										>
											{isForgotPasswordLoading
												? t("Just a moment...")
												: t("Forgot your password?")}
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

						{isError && <p className="text-red-500 -mb-2">{t("The data entered is incorrect.")}</p>}

						<TurnstileWidget
							ref={turnstileRef}
							sitekey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
							onVerify={(token) => {
								if (token && token.length > 0) {
									form.setValue("turnstileToken", token, { shouldValidate: true });
								}
							}}
						/>

						<LoaderSubmitButton
							isLoading={isLoading}
							disabled={isForgotPasswordLoading || !form.formState.isValid}
							className={cn("relative w-full", {
								"mb-4": lastMethod === "email",
							})}
						>
							<MailIcon className="w-4 h-4 inline-block" />
							{t("Login")}
							{lastMethod === "email" && (
								<span
									suppressHydrationWarning
									className="absolute w-full -z-1 -bottom-[1.35rem] bg-red-500/10 text-red-500/80 px-2 pt-3 py-0.5 rounded-b-md text-xs font-semibold"
								>
									{t("Last used")}
								</span>
							)}
						</LoaderSubmitButton>

						<div className="flex max-w-full items-center gap-2">
							<Button
								variant="outline"
								className="w-full"
								disabled={isLoading || isPasskeyLoading}
								type="button"
								onClick={async () => {
									setIsPasskeyLoading(true);
									authClient.signIn
										.passkey(
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
										)
										.then(() => {
											setIsPasskeyLoading(false);
										});
								}}
							>
								{isPasskeyLoading ? (
									<Loader />
								) : (
									<>
										<Key className="w-4 h-4 inline-block" />
										Passkey
									</>
								)}
							</Button>
							<GoogleLoginButton redirectTo={effectiveRedirectTo} wasLastMethod={lastMethod === "google"} />
						</div>
					</form>
				</Form>
				<div className="mt-8 text-center text-sm">
					{t("Don't have an account?")}{" "}
					<Link
						href={effectiveRedirectTo ? `/register?redirectTo=${encodeURIComponent(effectiveRedirectTo)}` : "/register"}
						className="underline"
					>
						{t("Register")}
					</Link>
				</div>
			</CardContent>
		</>
	);
}
