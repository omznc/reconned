"use client";

import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();
	const t = useTranslations();

	const [redirectTo] = useQueryState("redirectTo");
	const [message, setMessage] = useQueryState("message");

	useEffect(() => {
		if (message) {
			toast.info(decodeURIComponent(message));
			setMessage(null, { shallow: true });
		}
		authClient.oneTap();
	}, [message, setMessage]);

	function handleSuccessfulLogin() {
		router.push(redirectTo ? redirectTo : "/");
		router.refresh();
	}

	return (
		<>
			<CardHeader>
				<CardTitle className="text-2xl">{t("public.auth.twoFactor")}</CardTitle>
				<CardDescription>{t("public.auth.twoFactorDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={async (e) => {
						e.preventDefault();

						const formData = new FormData(e.currentTarget);
						const code = formData.get("totp") as string;
						const rememberDevice = formData.get("rememberDevice") === "on";

						// Try TOTP first, if it fails try backup code
						await authClient.twoFactor.verifyTotp(
							{
								code,
								trustDevice: rememberDevice, // Remember this device for 60 days
							},
							{
								onRequest: () => {
									setIsLoading(true);
								},
								onResponse: () => {
									setIsLoading(false);
								},
								onSuccess: handleSuccessfulLogin,
								onError: async () => {
									// If TOTP fails, try backup code
									await authClient.twoFactor.verifyBackupCode(
										{ code },
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
												toast.error(t("public.auth.twoFactorError"));
											},
										},
									);
								},
							},
						);
					}}
					className="grid gap-4"
				>
					<div className="grid gap-2">
						<Label htmlFor="totp">{t("public.auth.twoFactor")}</Label>
						<Input
							id="totp"
							type="text"
							name="totp"
							placeholder="123456"
							required={true}
							autoComplete="off"
						/>
					</div>
					<div className="flex items-center space-x-2">
						<Checkbox id="rememberDevice" name="rememberDevice" />
						<Label htmlFor="rememberDevice">{t("public.auth.rememberDevice")}</Label>
					</div>
					{isError && <p className="text-red-500">{t("public.auth.twoFactorError")}</p>}
					<LoaderSubmitButton isLoading={isLoading} className="w-full">
						{t("public.auth.verify")}
					</LoaderSubmitButton>
				</form>
				<div className="mt-4 text-center text-sm">
					{t("public.auth.noAccountQuestion")}{" "}
					<Link
						href={redirectTo ? `/register?redirectTo=${encodeURIComponent(redirectTo)}` : "/register"}
						className="underline"
					>
						{t("public.auth.register")}
					</Link>
				</div>
			</CardContent>
		</>
	);
}
