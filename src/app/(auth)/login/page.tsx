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

export default function LoginPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();

	useEffect(() => {
		authClient.oneTap();
	}, []);

	return (
		<>
			<CardHeader>
				<CardTitle className="text-2xl">Prijava</CardTitle>
				<CardDescription>
					Upisite svoj email i lozinku kako bi ste se pridružili svijetu
					airsofta.
				</CardDescription>
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
								onSuccess: () => {
									router.push("/");
								},
								onError: (ctx) => {
									if (ctx.error.status === 403) {
										toast.error(
											"Vaš račun nije verificiran. Molimo provjerite svoj email.",
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
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							name="email"
							placeholder="m@example.com"
							required={true}
						/>
					</div>
					<div className="grid gap-2">
						<div className="flex items-center">
							<Label htmlFor="password">Lozinka</Label>
							<Link href="#" className="ml-auto inline-block text-sm underline">
								Zaboravili ste lozinku?
							</Link>
						</div>
						<Input
							id="password"
							type="password"
							name="password"
							required={true}
						/>
					</div>
					{isError && (
						<p className="text-red-500 -mb-2">Podaci nisu ispravni</p>
					)}
					<LoaderSubmitButton isLoading={isLoading} className="w-full">
						Prijavi se
					</LoaderSubmitButton>
					<Button
						variant="outline"
						className="w-full"
						disabled={isLoading}
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
									onSuccess: () => {
										router.push("/");
									},
									onError: () => {
										setIsError(true);
									},
								},
							);
						}}
					>
						Prijavi se pomoću passkeya
					</Button>
					<GoogleLoginButton isLoading={isLoading} />
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
