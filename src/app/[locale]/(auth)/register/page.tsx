"use client";
import { GoogleLoginButton } from "@/app/[locale]/(auth)/_components/google-login-button";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TurnstileWidget, type TurnstileWidgetRef } from "@/app/[locale]/(auth)/_components/turnstile-widget";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";

export default function RegisterPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();
	const [email, setEmail] = useQueryState("email", {
		defaultValue: "",
		clearOnDefault: true,
		shallow: true,
	});
	const t = useTranslations("public.auth");
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
	const turnstileRef = useRef<TurnstileWidgetRef>(null);

	// Register form schema with Zod
	const registerSchema = z.object({
		name: z.string().min(1, t("nameRequired")),
		email: z.string().email(t("invalidEmail")),
		password: z.string().min(8, t("passwordTooShort")),
	});

	type RegisterFormValues = z.infer<typeof registerSchema>;

	// Initialize react-hook-form
	const form = useForm<RegisterFormValues>({
		resolver: zodResolver(registerSchema),
		defaultValues: {
			name: "",
			email: email || "",
			password: "",
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
		if (!turnstileToken) {
			toast.error(t("captchaError"));
			console.error("Missing turnstile token on register submit");
			return;
		}

		// Create headers with the token
		const headers = new Headers();
		headers.append("x-captcha-response", turnstileToken);

		setIsLoading(true);


		await authClient.signUp.email(
			{
				email: data.email,
				password: data.password,
				name: data.name,
			},
			{
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
					toast.success(t("registerSuccess"));
					router.push("/login");
					router.refresh();
				},
				onError: (ctx) => {
					console.error("Register error:", ctx.error);
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
				fetchOptions: {
					headers: headers,
				},
			},
		);
	}

	return (
		<>
			<CardHeader>
				<CardTitle className="text-2xl">{t("register")}</CardTitle>
				<CardDescription>
					{t("registerDescription")}{" "}
					<Accordion type="single" collapsible className="w-full border-b-none">
						<AccordionItem value="item-1" className="border-b-none">
							<AccordionTrigger className="border-b-none">
								<span className="text-red-500">
									{t("registerDescriptionTooltipTitle")}
								</span>
							</AccordionTrigger>
							<AccordionContent>
								{t("registerDescriptionTooltipDescription")}
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
									<Label htmlFor="name">{t("name")}</Label>
									<FormControl>
										<Input
											{...field}
											id="name"
											type="text"
											placeholder={t("name")}
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
									<Label htmlFor="password">{t("password")}</Label>
									<FormControl>
										<Input
											{...field}
											id="password"
											type="password"
											placeholder={t("password")}
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
									setTurnstileToken(token);
								}
							}}
						/>

						{isError && (
							<p className="text-red-500 -mb-2">{t("invalidDataOrUserExists")}</p>
						)}

						<LoaderSubmitButton
							isLoading={isLoading}
							className="w-full plausible-event-name=register-button-click"
							disabled={!(turnstileToken && form.formState.isValid)}
						>
							{t("register")}
						</LoaderSubmitButton>
						<GoogleLoginButton isLoading={isLoading} />
					</form>
				</Form>
				<div className="mt-4 text-center text-sm">
					{t("haveAccountQuestion")}{" "}
					<Link
						suppressHydrationWarning={true}
						href="/login"
						className="underline"
					>
						{t("login")}
					</Link>
				</div>
			</CardContent>
		</>
	);
}
