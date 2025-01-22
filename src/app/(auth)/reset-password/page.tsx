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
import { useTranslations } from "next-intl";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";

export default function LoginPage() {
	const [token, _] = useQueryState("token");
	const [isLoading, setIsLoading] = useState(false);
	const [isError, setIsError] = useState(false);
	const router = useRouter();
	const t = useTranslations("public.auth");

	if (!token) {
		redirect("/login");
	}

	return (
		<>
			<CardHeader>
				<CardTitle className="text-2xl">{t("resetPassword")}</CardTitle>
				<CardDescription>{t("resetPasswordDescription")}</CardDescription>
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
									toast.success(t("resetPasswordSuccess"));
									router.push("/login");
								},
								onError: (ctx) => {
									if (ctx.error.status === 403) {
										toast.error(t("resetPasswordError"));
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
						<Label htmlFor="password">{t("password")}</Label>
						<Input
							id="password"
							type="password"
							name="password"
							required={true}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
						<Input
							id="confirmPassword"
							type="password"
							name="confirmPassword"
							required={true}
						/>
					</div>
					{isError && <p className="text-red-500 -mb-2">{t("invalidData")}</p>}
					<LoaderSubmitButton isLoading={isLoading} className="w-full">
						{t("resetPassword")}
					</LoaderSubmitButton>
				</form>
				<div className="mt-4 text-center text-sm">
					{t("noAccountQuestion")}{" "}
					<Link href="/register" className="underline">
						{t("register")}
					</Link>
				</div>
			</CardContent>
		</>
	);
}
