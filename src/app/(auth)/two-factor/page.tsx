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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryState } from "nuqs";

export default function LoginPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();

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
				<CardTitle className="text-2xl">2-faktor autentikacija</CardTitle>
				<CardDescription>
					Upišite kod iz vaše aplikacije ili iskoristite rezervni kod.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={async (e) => {
						e.preventDefault();

						const formData = new FormData(e.currentTarget);
						const code = formData.get("totp") as string;

						// Try TOTP first, if it fails try backup code
						const totpResult = await authClient.twoFactor.verifyTotp(
							{
								code,
								trustDevice: true, // Remember this device for 60 days
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
												toast.error("Neispravan kod, pokušajte ponovo.");
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
						<Label htmlFor="totp">Kod</Label>
						<Input
							id="totp"
							type="text"
							name="totp"
							placeholder="123456"
							required={true}
							autoComplete="off"
						/>
					</div>
					{isError && <p className="text-red-500">Neispravan kod</p>}
					<LoaderSubmitButton isLoading={isLoading} className="w-full">
						Verificiraj
					</LoaderSubmitButton>
				</form>
				<div className="mt-4 text-center text-sm">
					{"Nemate račun? "}
					<Link
						href={
							redirectTo
								? `/register?redirectTo=${encodeURIComponent(redirectTo)}`
								: "/register"
						}
						className="underline"
					>
						Registrirajte se
					</Link>
				</div>
			</CardContent>
		</>
	);
}
