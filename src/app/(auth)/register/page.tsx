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
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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

	useEffect(() => {
		authClient.oneTap();
	}, []);

	return (
		<>
			<CardHeader>
				<CardTitle className="text-2xl">{t("register")}</CardTitle>
				<CardDescription>{t("registerDescription")}</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={async (e) => {
						e.preventDefault();

						const formData = new FormData(e.currentTarget);
						const localEmail = formData.get("email") as string;
						const password = formData.get("password") as string;
						const name = formData.get("name") as string;

						const success = await authClient.signUp.email(
							{
								email: email !== "" ? email : localEmail,
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

						toast.success(t("registerSuccess"));

						router.push("/login");
					}}
					className="grid gap-4"
				>
					<div className="grid gap-2">
						<Label htmlFor="name">{t("name")}</Label>
						<Input
							type="text"
							name="name"
							id="name"
							placeholder={t("name")}
							autoComplete="name"
							required={true}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="email">Email</Label>
						<Input
							key={email}
							type="email"
							name="email"
							id="email"
							placeholder="Email"
							disabled={!!email}
							defaultValue={email ?? undefined}
							autoComplete="email"
							required={true}
						/>
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
					</div>

					<div className="grid gap-2">
						<Label htmlFor="password">{t("password")}</Label>
						<Input
							type="password"
							name="password"
							id="password"
							placeholder={t("password")}
							autoComplete="current-password"
							required={true}
						/>
					</div>

					{isError && (
						<p className="text-red-500 -mb-2">{t("invalidDataOrUserExists")}</p>
					)}
					<LoaderSubmitButton
						isLoading={isLoading}
						className="w-full plausible-event-name=register-button-click"
					>
						{t("register")}
					</LoaderSubmitButton>
					<GoogleLoginButton isLoading={isLoading} />
				</form>
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
