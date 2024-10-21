"use client";

import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client"; //import the auth client
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();

	return (
		<>
			<CardHeader>
				<CardTitle className="text-2xl">Registracija</CardTitle>
				<CardDescription>Upišite svoj email i lozinku kako bi ste se pridružili svijetu airsofta.</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={async (e) => {
						e.preventDefault();

						const formData = new FormData(e.currentTarget);
						const email = formData.get("email") as string;
						const password = formData.get("password") as string;
						const name = formData.get("name") as string;

						await authClient.signUp.email(
							{
								email,
								password,
								name,
							},
							{
								onRequest: () => {
									setIsLoading(true);
								},
								onResponse: () => {
									setIsLoading(false);
								},
								onSuccess: () => {
									router.push("/login");
								},
								onError: () => {
									setIsError(true);
								},
							},
						);
					}}
					className="grid gap-4"
				>
					<div className="grid gap-2">
						<Label htmlFor="name">Ime</Label>
						<Input type="text" name="name" id="name" placeholder="Ime" autoComplete="name" required={true} />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="email">Email</Label>
						<Input type="email" name="email" id="email" placeholder="Email" autoComplete="email" required={true} />
					</div>

					<div className="grid gap-2">
						<Label htmlFor="password">Lozinka</Label>
						<Input
							type="password"
							name="password"
							id="password"
							placeholder="Lozinka"
							autoComplete="current-password"
							required={true}
						/>
					</div>
					{isError && <p className="text-red-500 -mb-2">Podaci nisu ispravni ili korisnik već postoji</p>}
					<Button disabled={isLoading} type="submit" className="w-full">
						{isLoading ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : "Registruj se"}
					</Button>
				</form>
				<div className="mt-4 text-center text-sm">
					{"Imate račun? "}
					<Link href="/login" className="underline">
						Prijavite se
					</Link>
				</div>
			</CardContent>
		</>
	);
}
