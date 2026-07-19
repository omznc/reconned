"use client";

import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthFormSkeleton } from "@/app/[locale]/(auth)/_components/auth-form-skeleton";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export default function TwoFactorPage() {
	return (
		<Suspense fallback={<AuthFormSkeleton />}>
			<TwoFactorPageContent />
		</Suspense>
	);
}

function TwoFactorPageContent() {
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();
	const t = useExtracted();

	const [redirectTo] = useQueryState("redirectTo");
	const [message, setMessage] = useQueryState("message");

	useEffect(() => {
		if (message) {
			toast.info(decodeURIComponent(message));
			setMessage(null, { shallow: true });
		}
	}, [message, setMessage]);

	function handleSuccessfulLogin() {
		router.push(redirectTo ? redirectTo : "/");
		router.refresh();
	}

	return (
		<>
			<CardHeader>
				<CardTitle className="text-2xl">{t("Two-factor authentication")}</CardTitle>
				<CardDescription>{t("Enter the code from your app or use the backup code.")}</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={async (e) => {
						e.preventDefault();

						const formData = new FormData(e.currentTarget);
						const code = formData.get("totp");
						const rememberDevice = formData.get("rememberDevice") === "on";

						if (!code || typeof code !== "string") {
							toast.error(t("Please enter a valid code."));
							return;
						}

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
												toast.error(t("The code entered is not valid."));
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
						<Label htmlFor="totp">{t("Two-factor authentication")}</Label>
						<InputOTP id="totp" name="totp" maxLength={6} required autoComplete="off" className="w-full">
							<InputOTPGroup className="w-full">
								<InputOTPSlot index={0} className="flex-1 h-14" />
								<InputOTPSlot index={1} className="flex-1 h-14" />
								<InputOTPSlot index={2} className="flex-1 h-14" />
								<InputOTPSlot index={3} className="flex-1 h-14" />
								<InputOTPSlot index={4} className="flex-1 h-14" />
								<InputOTPSlot index={5} className="flex-1 h-14" />
							</InputOTPGroup>
						</InputOTP>
					</div>
					<div className="flex items-center space-x-2">
						<Checkbox id="rememberDevice" name="rememberDevice" />
						<Label htmlFor="rememberDevice">{t("Remember this device")}</Label>
					</div>
					{isError && <p className="text-red-500">{t("The code entered is not valid.")}</p>}
					<LoaderSubmitButton isLoading={isLoading} className="w-full">
						{t("Confirm")}
					</LoaderSubmitButton>
				</form>
				<div className="mt-4 text-center text-sm">
					{t("Don't have an account?")}{" "}
					<Link
						href={redirectTo ? `/register?redirectTo=${encodeURIComponent(redirectTo)}` : "/register"}
						className="underline"
					>
						{t("Register")}
					</Link>
				</div>
			</CardContent>
		</>
	);
}
