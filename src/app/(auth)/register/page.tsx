"use client";
import { finalizeRegistration } from "@/app/(auth)/_actions/finalize-registration.action";
import { GoogleLoginButton } from "@/app/(auth)/_components/google-login-button";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client"; //import the auth client
import { Button } from "@components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();

	return (
		<>
			<CardHeader>
				<CardTitle className="text-2xl">Registracija</CardTitle>
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
						const name = formData.get("name") as string;
						const isClub = formData.get("isClub") as string;

						const success = await authClient.signUp.email(
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
								onError: () => {
									setIsError(true);
								},
							},
						);

						if (success.error) {
							return;
						}

						if (isClub !== "on") {
							router.push("/");
						}

						if (!success.error) {
							await finalizeRegistration({
								asClub: isClub === "on",
							});
						}
					}}
					className="grid gap-4"
				>
					<div className="grid gap-2">
						<Label htmlFor="name">Ime</Label>
						<Input
							type="text"
							name="name"
							id="name"
							placeholder="Ime"
							autoComplete="name"
							required={true}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="email">Email</Label>
						<Input
							type="email"
							name="email"
							id="email"
							placeholder="Email"
							autoComplete="email"
							required={true}
						/>
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
					<div className="flex gap-2 items-center">
						<Checkbox name="isClub" id="isClub" defaultChecked={false} />
						<Tooltip delayDuration={100}>
							<TooltipTrigger asChild={true}>
								<Label
									htmlFor="isClub"
									className="transition-all hover:underline"
								>
									Registriraj se kao klub
								</Label>
							</TooltipTrigger>
							<TooltipContent className="w-[150px]">
								<p>
									Odabirom ove opcije želite registrirati klub, te ćete postati
									vlasnik kluba.
								</p>
							</TooltipContent>
						</Tooltip>
					</div>

					{isError && (
						<p className="text-red-500 -mb-2">
							Podaci nisu ispravni ili korisnik već postoji
						</p>
					)}
					<LoaderSubmitButton isLoading={isLoading} className="w-full">
						Registruj se
					</LoaderSubmitButton>
					<GoogleLoginButton isLoading={isLoading} />
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
