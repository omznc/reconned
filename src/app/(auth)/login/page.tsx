"use client";

import { GoogleLoginButton } from "@/app/(auth)/_components/google-login-button";
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { Key } from "lucide-react";
import type { SuccessContext } from "better-auth/react";
import { BadgeSoon } from "@/components/badge-soon";
import { useTranslations } from "next-intl";

export default function LoginPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();
	const t = useTranslations("public.auth");

	const [redirectTo] = useQueryState("redirectTo");
	const [message, setMessage] = useQueryState("message");

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
		const inviteUrl = document.cookie
			.split("; ")
			.find((row) => row.startsWith("inviteUrl="))
			?.split("=")[1];

		if (inviteUrl) {
			document.cookie = "inviteUrl=; max-age=0; path=/";
			window.location.href = decodeURIComponent(inviteUrl);
			return;
		}

		router.push(redirectTo ? redirectTo : "/");
		router.refresh();
	}

	return (
		<>
			<CardHeader>
				<CardTitle className="text-2xl">{t("login")}</CardTitle>
				<CardDescription>{t("loginDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={async (e) => {
						e.preventDefault();

						const formData = new FormData(e.currentTarget);

						const email = formData.get("email") as string;
						const password = formData.get("password") as string;

						await authClient.signIn.email(
							{
								email,
								password,
							},
							{
								onRequest: () => {
									setIsLoading(true);
								},
								onResponse: () => {
									setIsLoading(false);
								},
								onSuccess: handleSuccessfulLogin,
								onError: (ctx) => {
									if (ctx.error.status === 403) {
										toast.error(t("unverified"));
									} else {
										setIsError(true);
									}
								},
							},
						);
					}}
					className="grid gap-4"
				>
					<div className="grid gap-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							name="email"
							placeholder="mail@example.com"
							autoComplete="email webauthn"
							suppressHydrationWarning
							required={true}
						/>
					</div>
					<div className="grid gap-2">
						<div className="flex items-center">
							<Label htmlFor="password">{t("password")}</Label>
							<Button
								type="button"
								onClick={async () => {
									if (isForgotPasswordLoading) {
										return;
									}
									setIsForgotPasswordLoading(true);
									const emailInput = document.getElementById(
										"email",
									) as HTMLInputElement;
									if (!emailInput?.value) {
										toast.error(t("forgotPasswordNoEmail"));
										setIsForgotPasswordLoading(false);
										return;
									}
									if (!emailInput?.checkValidity()) {
										toast.error(t("forgotPasswordWrongEmail"));
										setIsForgotPasswordLoading(false);
										return;
									}

									await authClient.forgetPassword({
										email: emailInput.value,
										redirectTo: "/reset-password",
									});
									toast.success(t("forgotPasswordSuccess"));
									setIsForgotPasswordLoading(false);
								}}
								variant="ghost"
								className="ml-auto inline-block text-sm underline plausible-event-name=forgot-password-click"
								disabled={isLoading || isForgotPasswordLoading}
							>
								{isForgotPasswordLoading ? t("loading") : t("forgotPassword")}
							</Button>
						</div>
						<Input
							autoComplete="current-password webauthn"
							id="password"
							type="password"
							name="password"
							required={true}
						/>
					</div>
					{isError && <p className="text-red-500 -mb-2">{t("invalidData")}</p>}
					<LoaderSubmitButton
						isLoading={isLoading}
						disabled={isForgotPasswordLoading}
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
						<GoogleLoginButton isLoading={isLoading} redirectTo={redirectTo} />
					</div>
				</form>
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
