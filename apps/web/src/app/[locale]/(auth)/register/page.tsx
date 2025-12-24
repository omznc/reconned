"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import posthog from "posthog-js";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { GoogleLoginButton } from "@/app/[locale]/(auth)/_components/google-login-button";
import { TurnstileWidget, type TurnstileWidgetRef } from "@/app/[locale]/(auth)/_components/turnstile-widget";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { env } from "@/lib/env";

export default function RegisterPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();
	const [email, setEmail] = useQueryState("email", {
		defaultValue: "",
		clearOnDefault: true,
		shallow: true,
	});
	const t = useExtracted();
	const turnstileRef = useRef<TurnstileWidgetRef>(null);

	// Register form schema with Zod
	const registerSchema = z.object({
		name: z.string().min(1, t("Your name is required")),
		email: z.email(t("Invalid email")),
		password: z.string().min(8, t("That password is too short")),
		turnstileToken: z.string().min(1, t("Captcha error")),
	});

	type RegisterFormValues = z.infer<typeof registerSchema>;

	// Initialize react-hook-form
	const form = useForm<RegisterFormValues>({
		resolver: zodResolver(registerSchema),
		defaultValues: {
			name: "",
			email: email || "",
			password: "",
			turnstileToken: "",
		},
		mode: "onChange",
	});

	// Update form email value when email query param changes
	useEffect(() => {
		if (email) {
			form.setValue("email", email);
		}
	}, [email, form]);

	useEffect(() => {
		authClient.oneTap();
	}, []);

	async function onSubmit(data: RegisterFormValues) {
		const headers = new Headers();
		headers.append("x-captcha-response", data.turnstileToken);

		setIsLoading(true);

		// Track registration attempt
		posthog.capture("user_registration_attempt", {
			email: data.email,
			method: "email",
		});

		await authClient.signUp.email({
			email: data.email,
			password: data.password,
			name: data.name,
			fetchOptions: {
				headers: headers,
				onRequest: () => {
					setIsLoading(true);
				},
				onResponse: () => {
					setIsLoading(false);
					// Reset Turnstile widget UI on response, don't clear token state
					if (turnstileRef.current) {
						turnstileRef.current.reset();
					}
				},
				onSuccess: () => {
					posthog.capture("user_registration_success", {
						email: data.email,
						method: "email",
					});
					toast.success(t("You have successfully registered. Check your email to verify it."));
					router.push("/login");
					router.refresh();
				},
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
			<CardHeader>
				<CardTitle className="text-2xl">{t("Register")}</CardTitle>
				<CardDescription>
					{t("Create your account and join the airsoft community.")}{" "}
					<Accordion type="single" collapsible className="w-full border-b-none">
						<AccordionItem value="item-1" className="border-b-none">
							<AccordionTrigger className="border-b-none">
								<span className="text-red-500">{t("Registering a club?")}</span>
							</AccordionTrigger>
							<AccordionContent>
								{t(
									"If you want to add your club, register as yourself. After logging in, you will be able to add a club and be its owner.",
								)}
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<Label htmlFor="name">{t("Name")}</Label>
									<FormControl>
										<Input
											{...field}
											id="name"
											type="text"
											placeholder={t("Name")}
											autoComplete="name"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

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
											placeholder="Email"
											disabled={!!email}
											autoComplete="email"
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
									<Label htmlFor="password">{t("Password")}</Label>
									<FormControl>
										<Input
											{...field}
											id="password"
											type="password"
											placeholder={t("Password")}
											autoComplete="new-password"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<TurnstileWidget
							ref={turnstileRef}
							sitekey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
							onVerify={(token) => {
								if (token && token.length > 0) {
									form.setValue("turnstileToken", token, { shouldValidate: true });
								}
							}}
						/>

						{isError && (
							<p className="text-red-500 -mb-2">
								{t("The entered data is incorrect or the user already exists.")}
							</p>
						)}

						<LoaderSubmitButton
							isLoading={isLoading}
							className="relative w-full"
							disabled={!form.formState.isValid}
						>
							{t("Register")}
						</LoaderSubmitButton>
						<GoogleLoginButton />
					</form>
				</Form>
				<div className="mt-8 text-center text-sm">
					{t("Already have an account?")}{" "}
					<Link suppressHydrationWarning={true} href="/login" className="underline">
						{t("Login")}
					</Link>
				</div>
			</CardContent>
		</>
	);
}
