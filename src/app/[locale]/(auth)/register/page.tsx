"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
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

export default function RegisterPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();
	const [email, setEmail] = useQueryState("email", {
		defaultValue: "",
		clearOnDefault: true,
		shallow: true,
	});
	const t = useTranslations();
	const turnstileRef = useRef<TurnstileWidgetRef>(null);
	const lastMethod = authClient.getLastUsedLoginMethod();
	// Register form schema with Zod
	const registerSchema = z.object({
		name: z.string().min(1, t("public.auth.nameRequired")),
		email: z.string().email(t("public.auth.invalidEmail")),
		password: z.string().min(8, t("public.auth.passwordTooShort")),
		turnstileToken: z.string().min(1, t("public.auth.captchaError")),
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
		// Create headers with the token
		const headers = new Headers();
		headers.append("x-captcha-response", data.turnstileToken);

		setIsLoading(true);

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
					toast.success(t("public.auth.registerSuccess"));
					router.push("/login");
					router.refresh();
				},
				onError: (ctx) => {
					if (ctx.error.status === 403) {
						toast.error(t("public.auth.unverified"));
					} else {
						if (ctx.error.message === "Missing CAPTCHA response") {
							toast.error(t("public.auth.captchaError"));
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
				<CardTitle className="text-2xl">{t("public.auth.register")}</CardTitle>
				<CardDescription>
					{t("public.auth.registerDescription")}{" "}
					<Accordion type="single" collapsible className="w-full border-b-none">
						<AccordionItem value="item-1" className="border-b-none">
							<AccordionTrigger className="border-b-none">
								<span className="text-red-500">{t("public.auth.registerDescriptionTooltipTitle")}</span>
							</AccordionTrigger>
							<AccordionContent>
								{t("public.auth.registerDescriptionTooltipDescription")}
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
									<Label htmlFor="name">{t("public.auth.name")}</Label>
									<FormControl>
										<Input
											{...field}
											id="name"
											type="text"
											placeholder={t("public.auth.name")}
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
											{t("public.auth.emailAutofilled")}{" "}
											{/* biome-ignore lint/a11y/useSemanticElements: Style stuff */}
											<span
												role="button"
												tabIndex={0}
												className="text-foreground cursor-pointer inline"
												onClick={() => {
													setEmail("");
												}}
											>
												{t("public.auth.remove")}
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
									<Label htmlFor="password">{t("public.auth.password")}</Label>
									<FormControl>
										<Input
											{...field}
											id="password"
											type="password"
											placeholder={t("public.auth.password")}
											autoComplete="new-password"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<TurnstileWidget
							ref={turnstileRef}
							onVerify={(token) => {
								if (token && token.length > 0) {
									form.setValue("turnstileToken", token, { shouldValidate: true });
								}
							}}
						/>

						{isError && <p className="text-red-500 -mb-2">{t("public.auth.invalidDataOrUserExists")}</p>}

						<LoaderSubmitButton
							isLoading={isLoading}
							className="relative w-full plausible-event-name=register-button-click"
							disabled={!form.formState.isValid}
						>
							{t("public.auth.register")}
							{lastMethod === "email" && (
								<span className="absolute w-full -bottom-[1.35rem] bg-red-500/10 text-red-500/80 px-2 py-0.5 rounded-md text-xs font-semibold">
									{t("public.auth.lastUsed")}
								</span>
							)}
						</LoaderSubmitButton>
						<GoogleLoginButton wasLastMethod={lastMethod === "google"} />
					</form>
				</Form>
				<div className="mt-8 text-center text-sm">
					{t("public.auth.haveAccountQuestion")}{" "}
					<Link suppressHydrationWarning={true} href="/login" className="underline">
						{t("public.auth.login")}
					</Link>
				</div>
			</CardContent>
		</>
	);
}
