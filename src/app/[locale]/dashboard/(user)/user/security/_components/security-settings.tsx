"use client";

import { authClient } from "@auth/client";
import type { Passkey } from "@better-auth/passkey";
import { Button } from "@components/ui/button";
import type { Session } from "@generated/client";
import { formatDistanceToNow } from "date-fns";
import { bs } from "date-fns/locale";
import { Dice5, Download, KeyRound, Laptop, ShieldQuestion, Smartphone, Tablet, Trash2 } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { PasswordChangeForm } from "@/app/[locale]/dashboard/(user)/user/security/_components/password-change.form";
import { SetupPasswordForm } from "@/app/[locale]/dashboard/(user)/user/security/_components/password-setup.form";
import { BadgeSoon } from "@/components/badge-soon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePrompt } from "@/components/ui/alert-dialog-provider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface SecuritySettingsProps {
	passkeys: Passkey[];
	hasPassword: boolean;
	hasTwoFactor?: boolean | null;
	backupCodes?: string | null;
	sessions: (Omit<Session, "impersonatedBy"> & {
		isCurrentSession: boolean;
	})[];
}

export function SecuritySettings({
	passkeys,
	hasPassword,
	hasTwoFactor,
	backupCodes: backupCodesString,
	sessions,
}: SecuritySettingsProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [regeneratedBackupCodes, setRegeneratedBackupCodes] = useState<string[] | null>(null);
	const router = useRouter();
	const prompt = usePrompt();
	const t = useExtracted();
	const locale = useLocale();
	const backupCodes: string[] = JSON.parse((backupCodesString?.length ?? 0) > 0 ? backupCodesString || "[]" : "[]");
	const displayBackupCodes = regeneratedBackupCodes || backupCodes;
	const hasBackupCodes = displayBackupCodes.length > 0;

	const getDeviceIcon = (userAgent?: string) => {
		if (!userAgent) return ShieldQuestion;
		if (userAgent.includes("Mobile")) return Smartphone;
		if (userAgent.includes("Tablet")) return Tablet;
		return Laptop;
	};

	return (
		<>
			{hasPassword ? (
				<PasswordChangeForm isLoading={isLoading} setIsLoading={setIsLoading} />
			) : (
				<SetupPasswordForm isLoading={isLoading} setIsLoading={setIsLoading} />
			)}
			<div className="flex flex-col gap-1">
				<h3 className="text-lg font-semibold">Passkey</h3>
			</div>
			<div className="space-y-2">
				{passkeys.map((passkey) => (
					<Alert key={passkey.id} className="flex flex-col md:flex-row gap-1 justify-between -z-0">
						<div className="flex flex-col">
							<AlertTitle>{passkey.name ?? t("Passkey")}</AlertTitle>
							<AlertDescription>
								{t("Created on {date}", {
									date: passkey.createdAt?.toLocaleDateString(locale, {
										year: "numeric",
										month: "long",
										day: "numeric",
									}),
								})}
							</AlertDescription>
						</div>
						<Button
							type="button"
							variant="destructive"
							className="w-full md:w-auto"
							disabled={isLoading}
							onClick={async () => {
								await authClient.passkey.deletePasskey(
									{ id: passkey.id },
									{
										onRequest: () => {
											setIsLoading(true);
										},
										onSuccess: () => {
											setIsLoading(false);
											router.refresh();
										},
										onError: () => {
											setIsLoading(false);
										},
									},
								);
							}}
						>
							<Trash2 className="w-4 h-4" />
						</Button>
					</Alert>
				))}
				<Alert className="flex flex-col md:flex-row gap-1 justify-between -z-0">
					<div className="flex flex-col">
						<AlertTitle>{t("Add a new Passkey")}</AlertTitle>
						<AlertDescription>
							{t("Add a new passkey for faster and more secure login to your account.")}
						</AlertDescription>
					</div>
					<Button
						type="button"
						className="w-full md:w-auto"
						disabled={isLoading || true}
						onClick={async () => {
							await authClient.passkey.addPasskey(
								{},
								{
									onRequest: () => {
										setIsLoading(true);
									},
									onSuccess: () => {
										setIsLoading(false);
										router.refresh();
									},
									onError: () => {
										setIsLoading(false);
									},
								},
							);
						}}
					>
						<KeyRound className="w-4 h-4 mr-2" />
						{t("Add")}
						<BadgeSoon />
					</Button>
				</Alert>
			</div>
			<div className="flex flex-col gap-1">
				<h3 className="text-lg font-semibold">{t("Two-factor authentication")}</h3>
			</div>
			{!hasPassword && (
				<Alert className="flex flex-col gap-1">
					<AlertTitle>{t("Two-factor authentication is not available")}</AlertTitle>
					<AlertDescription>
						{t("To use 2-factor authentication, you must first set a password.")}
					</AlertDescription>
				</Alert>
			)}
			{hasPassword && (
				<div className="space-y-2">
					{hasTwoFactor ? (
						<>
							<Alert className="flex flex-col md:flex-row gap-1 justify-between -z-0">
								<div className="flex flex-col">
									<AlertTitle>{t("Disable 2-factor authentication")}</AlertTitle>
									<AlertDescription>
										{t(
											"If you turn off 2-factor authentication, you will be able to log into your account without confirmation through the application.",
										)}
									</AlertDescription>
								</div>
								<Button
									type="button"
									variant="destructive"
									disabled={isLoading}
									className="w-full md:w-auto"
									onClick={async () => {
										const confirmed = await prompt({
											cancelButton: t("Cancel"),
											cancelButtonVariant: "ghost",
											title: t("Disable 2-factor authentication?"),
											body: t("Are you sure you want to disable 2-factor authentication? "),
											actionButton: t("Disable"),
											inputType: "input",
											inputProps: {
												type: "password",
											},
										});

										if (!confirmed) {
											return;
										}

										await authClient.twoFactor.disable(
											{
												password: confirmed,
											},
											{
												onRequest: () => {
													setIsLoading(true);
												},
												onSuccess: () => {
													setIsLoading(false);
													router.refresh();
												},
												onError: () => {
													setIsLoading(false);
													toast.error(t("Please enter the correct password"));
												},
											},
										);
									}}
								>
									{t("Disable")}
								</Button>
							</Alert>
							{!hasBackupCodes ? (
								<Alert className="flex flex-col gap-1">
									<AlertTitle className="flex items-center gap-4 justify-between">
										<span>{t("Backup codes")}</span>
										<Button
											type="button"
											variant="outline"
											disabled={isLoading}
											onClick={async () => {
												const confirmed = await prompt({
													title: t("Regenerate codes"),
													body: t(
														"These are your backup codes for 2-factor authentication. Enter your password to regenerate them.",
													),
													cancelButton: t("No, go back"),
													actionButton: t("Regenerate"),
													actionButtonVariant: "destructive",
													inputType: "input",
													inputProps: {
														type: "password",
													},
												});

												if (!confirmed) {
													return;
												}

												await authClient.twoFactor.generateBackupCodes(
													{
														password: confirmed,
													},
													{
														onRequest: () => {
															setIsLoading(true);
														},
														onSuccess: (r) => {
															setIsLoading(false);
															setRegeneratedBackupCodes(r.data.backupCodes);
															toast.success(t("Codes successfully regenerated"));
														},
														onError: () => {
															setIsLoading(false);
															toast.error(
																t("An error occurred while regenerating the codes"),
															);
														},
													},
												);
											}}
										>
											<Dice5 className="w-4 h-4 mr-2" />
											{t("Regenerate codes")}
										</Button>
									</AlertTitle>
									<AlertDescription>
										{t(
											"Backup codes are not visible for security reasons. You need to regenerate them to see and save them. Warning: regenerating will invalidate all existing backup codes.",
										)}
									</AlertDescription>
								</Alert>
							) : (
								<Alert className="flex flex-col gap-1">
									<AlertTitle className="flex items-center gap-2 justify-between">
										<span>{t("Backup codes")}</span>
										<div className="flex gap-2">
											<Button
												type="button"
												variant="outline"
												disabled={isLoading}
												onClick={() => {
													const text = displayBackupCodes?.join("\n") ?? "";
													const blob = new Blob([text], {
														type: "text/plain",
													});
													const url = window.URL.createObjectURL(blob);
													const a = document.createElement("a");
													a.href = url;
													a.download = t("backup-codes.txt");
													a.click();
													window.URL.revokeObjectURL(url);
												}}
											>
												<Download className="w-4 h-4 mr-2" />
												{t("Download")}
											</Button>
											<Button
												type="button"
												variant="outline"
												onClick={async () => {
													const confirmed = await prompt({
														title: t("Regenerate codes"),
														body: t(
															"These are your backup codes for 2-factor authentication. Enter your password to regenerate them.",
														),
														cancelButton: t("No, go back"),
														actionButton: t("Regenerate"),
														actionButtonVariant: "destructive",
														inputType: "input",
														inputProps: {
															type: "password",
														},
													});

													if (!confirmed) {
														return;
													}

													await authClient.twoFactor.generateBackupCodes(
														{
															password: confirmed,
														},
														{
															onRequest: () => {
																setIsLoading(true);
															},
															onSuccess: (r) => {
																setIsLoading(false);
																setRegeneratedBackupCodes(r.data.backupCodes);
																toast.success(t("Codes successfully regenerated"));
															},
															onError: () => {
																setIsLoading(false);
																toast.error(
																	t("An error occurred while regenerating the codes"),
																);
															},
														},
													);
												}}
											>
												<Dice5 className="w-4 h-4 mr-2" />
												{t("Regenerate codes")}
											</Button>
										</div>
									</AlertTitle>
									<AlertDescription>
										{t(
											"These are your backup codes for 2-factor authentication. Enter your password to regenerate them.",
										)}
									</AlertDescription>
									<div className="bg-background border p-4 mt-2 flex flex-wrap gap-2">
										{displayBackupCodes?.map((code) => (
											<code
												onClick={() => {
													navigator.clipboard.writeText(code);
													toast.success(t("Copied to clipboard."));
												}}
												key={code}
												className="grow cursor-pointer text-center bg-sidebar blur-sm hover:blur-none transition-all p-2 font-mono"
											>
												{code}
											</code>
										))}
									</div>
								</Alert>
							)}
						</>
					) : (
						<Alert className="flex flex-col md:flex-row gap-1 justify-between -z-0">
							<div className="flex flex-col">
								<AlertTitle>{t("Enable 2-factor authentication")}</AlertTitle>
								<AlertDescription>
									{t("Enable 2-factor authentication for extra security of your account.")}
								</AlertDescription>
							</div>
							<Button
								type="button"
								disabled={isLoading}
								className="w-full md:w-auto"
								onClick={async () => {
									const password = await prompt({
										cancelButton: t("Cancel"),
										cancelButtonVariant: "ghost",
										title: t("Enable 2-factor authentication?"),
										body: t("Enter your password to enable 2-factor authentication."),
										actionButton: t("Confirm"),
										inputType: "input",
										inputProps: {
											type: "password",
										},
									});

									if (!password) {
										return;
									}

									const resp = await authClient.twoFactor.enable(
										{
											password: password,
										},
										{
											onRequest: () => {
												setIsLoading(true);
											},
											onSuccess: () => {
												setIsLoading(false);
												router.refresh();
											},
											onError: () => {
												setIsLoading(false);
												toast.error(t("Invalid password, please try again."));
											},
										},
									);

									if (resp?.error) {
										return;
									}

									const confirmed = await prompt({
										cancelButton: t("Cancel"),
										cancelButtonVariant: "ghost",
										title: t("Enable 2-factor authentication?"),
										body: (
											<div className="space-y-2">
												<p>
													{t("Scan the QR code with your app for 2-factor authentication.")}
												</p>
												<div className="w-fit flex flex-col items-center w-full">
													<QRCodeSVG value={resp.data.totpURI} className="w-full" />
													<p className="mt-2 w-full text-left">
														{t("If you can't scan the QR code, enter this code:")}
													</p>
													<code className="font-semibold select-all break-all whitespace-pre-wrap">
														{resp.data.totpURI.split("?secret=")[1]?.split("&")[0]}
													</code>
												</div>
												<span className="block mt-2">
													{t("Confirm the 6-digit code you received from the app")}
												</span>
											</div>
										),
										actionButton: t("Enable"),
										inputType: "input",
										inputProps: {
											type: "text",
										},
									});

									if (!confirmed) {
										return;
									}

									await authClient.twoFactor.verifyTotp(
										{
											code: confirmed,
										},
										{
											onRequest: () => {
												setIsLoading(true);
											},
											onSuccess: () => {
												setIsLoading(false);
												router.refresh();
											},
											onError: () => {
												setIsLoading(false);
												toast.error(t("Please enter a valid 6-digit code"));
											},
										},
									);
								}}
							>
								{t("Confirm")}
							</Button>
						</Alert>
					)}
				</div>
			)}
			<div className="flex flex-col gap-1">
				<h3 className="text-lg font-semibold">{t("Active sessions")}</h3>
				<p className="text-sm text-muted-foreground">
					{t("Here you can see all active sessions on your account. ")}
				</p>
			</div>
			{sessions.length > 1 && (
				<Alert>
					<AlertDescription className="flex justify-between items-center">
						<span>{t("Sign out of all devices except this one.")}</span>
						<Button
							type="button"
							variant="destructive"
							disabled={isLoading}
							onClick={async () => {
								await authClient.revokeOtherSessions(
									{},
									{
										onRequest: () => setIsLoading(true),
										onSuccess: () => {
											setIsLoading(false);
											router.refresh();
											toast.success(t("You are signed out of all other devices"));
										},
										onError: () => {
											setIsLoading(false);
											toast.error(t("An error occurred while signing out from other devices."));
										},
									},
								);
							}}
						>
							{t("Sign out")}
						</Button>
					</AlertDescription>
				</Alert>
			)}
			<ScrollArea className="max-h-[400px] border rounded-md overflow-y-auto">
				<div className="p-4 space-y-2">
					{sessions.map((session) => {
						const Icon = getDeviceIcon(session.userAgent ?? undefined);
						return (
							<Alert
								key={session.id}
								className={cn("flex flex-col md:flex-row gap-1 justify-between -z-0", {
									"bg-sidebar": session.isCurrentSession,
								})}
							>
								<div className="flex gap-4 items-center">
									<Icon className="w-8 h-8" />
									<div className="flex flex-col gap-1">
										<AlertTitle className="flex items-center gap-4 w-full ">
											{session.userAgent?.split("/")[0] || t("Unknown Device")}
											{session.isCurrentSession && <Badge>{t("Current session")}</Badge>}
										</AlertTitle>
										<AlertDescription>
											{session.ipAddress && (
												<span className="block text-xs">IP: {session.ipAddress}</span>
											)}
											<span className="block text-xs">
												{t("Last used on {date}", {
													date: formatDistanceToNow(session.updatedAt, {
														addSuffix: true,
														locale: bs,
													}),
												})}
											</span>
										</AlertDescription>
									</div>
								</div>
								{!session.isCurrentSession && (
									<Button
										type="button"
										variant="destructive"
										className="w-full md:w-auto"
										disabled={isLoading}
										onClick={async () => {
											await authClient.revokeSession(
												{ token: session.token },
												{
													onRequest: () => setIsLoading(true),
													onSuccess: () => {
														setIsLoading(false);
														router.refresh();
														toast.success(t("You are signed out of this device"));
													},
													onError: () => {
														setIsLoading(false);
														toast.error(
															t("An error occurred while logging out of this device."),
														);
													},
												},
											);
										}}
									>
										<Trash2 className="w-4 h-4" />
									</Button>
								)}
							</Alert>
						);
					})}
				</div>
			</ScrollArea>
		</>
	);
}
