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
import { redirect, useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function LoginPage() {
	const [token, setToken] = useQueryState("token");
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();

	if (!token) {
		redirect("/login");
	}

	return (
		<>
			<CardHeader>
				<CardTitle className="text-2xl">Restuj šifru</CardTitle>
				<CardDescription>
					Upišite novu šifru kako bi ste pristupili svom računu.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={async (e) => {
						e.preventDefault();

						const formData = new FormData(e.currentTarget);

						const password = formData.get("password") as string;
						const confirmPassword = formData.get("confirmPassword") as string;

						if (password !== confirmPassword) {
							toast.error("Šifre se ne podudaraju.");
							return;
						}

						await authClient.resetPassword(
							{
								newPassword: password,
							},
							{
								onRequest: () => {
									setIsLoading(true);
								},
								onResponse: () => {
									setIsLoading(false);
								},
								onSuccess: () => {
									toast.success("Šifra uspješno resetirana, ulogujte se.");
									router.push("/login");
								},
								onError: (ctx) => {
									if (ctx.error.status === 403) {
										toast.error(
											"Problem pri resetiranju šifre. Molimo pokušajte ponovo.",
										);
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
						<Label htmlFor="password">Lozinka</Label>
						<Input
							id="password"
							type="password"
							name="password"
							required={true}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="confirmPassword">Potvrdi lozinku</Label>
						<Input
							id="confirmPassword"
							type="password"
							name="confirmPassword"
							required={true}
						/>
					</div>
					{isError && (
						<p className="text-red-500 -mb-2">Podaci nisu ispravni</p>
					)}
					<LoaderSubmitButton isLoading={isLoading} className="w-full">
						Potvrdi
					</LoaderSubmitButton>
				</form>
				<div className="mt-4 text-center text-sm">
					{"Nemate račun? "}
					<Link href="/register" className="underline">
						Registrirajte se
					</Link>
				</div>
			</CardContent>
		</>
	);
}
