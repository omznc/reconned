"use client";

import { authClient } from "@auth/client";
import type { Passkey } from "@better-auth/passkey";
import { Button } from "@components/ui/button";
import type { Session } from "better-auth/client";
import { formatDistanceToNow } from "date-fns";
import { Dice5, Download, KeyRound, Laptop, ShieldQuestion, Smartphone, Tablet, Trash2 } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { PasswordChangeForm } from "@/app/[locale]/dashboard/(user)/user/security/_components/password-change.form";
import { SetupPasswordForm } from "@/app/[locale]/dashboard/(user)/user/security/_components/password-setup.form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAlert, usePrompt } from "@/components/ui/alert-dialog-provider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import { getDateFnsLocale } from "@/lib/date-locale";
import { cn } from "@/lib/utils";

interface SecuritySettingsProps {
	passkeys: Passkey[];
	hasPassword: boolean;
	hasTwoFactor?: boolean | null;
	backupCodes?: string | null;
	sessions: Session[];
	currentSession: Session;
	userId: string;
}

export function SecuritySettings({
	passkeys,
	hasPassword,
	hasTwoFactor,
	sessions,
	userId,
	currentSession,
}: SecuritySettingsProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [regeneratedBackupCodes, setRegeneratedBackupCodes] = useState<string[] | null>(null);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [showQrDialog, setShowQrDialog] = useState(false);
	const [qrData, setQrData] = useState<{ totpURI: string; password: string } | null>(null);
	const router = useRouter();
	const prompt = usePrompt();
	const alert = useAlert();
	const t = useExtracted();
	const locale = useLocale();
	const dateLocale = getDateFnsLocale(locale);
	const hasBackupCodes = regeneratedBackupCodes && regeneratedBackupCodes.length > 0;

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
					<Alert key={passkey.id} className="flex flex-col md:flex-row gap-1 justify-between z-0">
						<div className="flex flex-col">
							<AlertTitle>{passkey.name || t("Passkey")}</AlertTitle>
							<AlertDescription>
								{t("Created on {date}", {
									date: new Date(passkey.createdAt).toLocaleDateString(locale, {
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
				<Alert className="flex flex-col md:flex-row gap-1 justify-between z-0">
					<div className="flex flex-col">
						<AlertTitle>{t("Add a new Passkey")}</AlertTitle>
						<AlertDescription>
							{t("Add a new passkey for faster and more secure login to your account.")}
						</AlertDescription>
					</div>
					<Button
						type="button"
						className="w-full md:w-auto"
						disabled={isLoading}
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
							<Alert className="flex flex-col md:flex-row gap-1 justify-between z-0">
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
											body: t(
												"Are you sure you want to disable 2-factor authentication? Input your password to confirm.",
											),
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
											size="sm"
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
												size="sm"
												type="button"
												variant="outline"
												disabled={isLoading}
												onClick={() => {
													const text = regeneratedBackupCodes?.join("\n") || "";
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
										{regeneratedBackupCodes?.map((code) => (
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
						<Alert className="flex flex-col md:flex-row gap-1 justify-between z-0">
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
										body: (
											<div className="space-y-2">
												<p>{t("Enter your password to enable 2-factor authentication.")}</p>
											</div>
										),
										actionButton: t("Continue"),
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

									setQrData({ totpURI: resp.data.totpURI, password: password });
									setShowQrDialog(true);
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
						const Icon = getDeviceIcon(session.userAgent || undefined);
						return (
							<Alert
								key={session.id}
								className={cn("flex flex-col md:flex-row gap-1 justify-between z-0", {
									"bg-sidebar": session.id === currentSession.id,
								})}
							>
								<div className="flex gap-4 items-center">
									<Icon className="w-8 h-8" />
									<div className="flex flex-col gap-1">
										<AlertTitle className="flex items-center gap-4 w-full ">
											{session.userAgent?.split("/")[0] || t("Unknown Device")}
											{session.id === currentSession.id && <Badge>{t("Current session")}</Badge>}
										</AlertTitle>
										<AlertDescription>
											{session.ipAddress && (
												<span className="block text-xs">IP: {session.ipAddress}</span>
											)}
											<span className="block text-xs">
												{t("Last used on {date}", {
													date: formatDistanceToNow(session.updatedAt, {
														addSuffix: true,
														locale: dateLocale,
													}),
												})}
											</span>
										</AlertDescription>
									</div>
								</div>
								{session.id !== currentSession.id && (
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
			<div className="flex flex-col gap-1">
				<h3 className="text-lg font-semibold">{t("Delete account")}</h3>
				<p className="text-sm text-muted-foreground">
					{t("Permanently delete your account and all associated data. This action cannot be undone.")}
				</p>
			</div>
			<Alert variant="destructive">
				<AlertDescription className="space-y-4">
					<p>
						{t(
							"Deleting your account will permanently remove all your data. If you are a club owner, ownership will be transferred to a random manager, or the club will become unclaimed if no managers exist.",
						)}
					</p>
					<Button
						type="button"
						variant="destructive"
						disabled={isLoading}
						onClick={() => setShowDeleteDialog(true)}
					>
						{t("Delete my account")}
					</Button>
				</AlertDescription>
			</Alert>

			<AlertDialog open={showQrDialog} onOpenChange={setShowQrDialog}>
				<AlertDialogContent className="max-w-md">
					<AlertDialogHeader>
						<AlertDialogTitle>{t("Scan QR Code")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("Scan the QR code with your app for 2-factor authentication.")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					{qrData && (
						<form
							id="verify-2fa-form"
							onSubmit={async (e) => {
								e.preventDefault();
								setIsLoading(true);

								const formData = new FormData(e.currentTarget);
								const code = formData.get("code") as string;

								await authClient.twoFactor.verifyTotp(
									{ code },
									{
										onRequest: () => {
											setIsLoading(true);
										},
										onSuccess: async () => {
											const backupCodes = await authClient.twoFactor.generateBackupCodes({
												password: qrData.password,
											});

											if (backupCodes.data) {
												await alert({
													title: t("2FA Enabled - Save Your Backup Codes"),
													body: (
														<div className="space-y-4">
															<div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md p-3">
																<p className="text-sm text-green-800 dark:text-green-200 font-medium">
																	{t("Two-factor authentication has been enabled")}
																</p>
																<p className="text-sm text-green-700 dark:text-green-300 mt-1">
																	{t(
																		"Save these backup codes and log back in with your 2FA.",
																	)}
																</p>
															</div>

															<div>
																<p className="font-medium mb-2">
																	{t("Your backup codes:")}
																</p>
																<div className="bg-background border p-4 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
																	{backupCodes.data.backupCodes.map(
																		(code: string, index: number) => (
																			<code
																				onClick={() => {
																					navigator.clipboard.writeText(code);
																					toast.success(
																						t("Copied to clipboard."),
																					);
																				}}
																				key={index}
																				className="cursor-pointer text-center bg-sidebar hover:bg-sidebar/80 transition-colors p-2 font-mono text-sm rounded"
																			>
																				{code}
																			</code>
																		),
																	)}
																</div>
															</div>

															<div className="flex gap-2">
																<Button
																	variant="outline"
																	className="flex-1"
																	onClick={() => {
																		const text =
																			backupCodes.data.backupCodes.join("\n");
																		const blob = new Blob([text], {
																			type: "text/plain",
																		});
																		const url = window.URL.createObjectURL(blob);
																		const a = document.createElement("a");
																		a.href = url;
																		a.download = t("backup-codes-2fa.txt");
																		a.click();
																		window.URL.revokeObjectURL(url);
																		toast.success(t("Backup codes downloaded"));
																	}}
																>
																	<Download className="w-4 h-4 mr-2" />
																	{t("Download")}
																</Button>
															</div>
														</div>
													),
												});

												setShowQrDialog(false);
												setQrData(null);
												router.refresh();
											}

											setIsLoading(false);
										},
										onError: () => {
											setIsLoading(false);
											toast.error(t("Please enter a valid 6-digit code"));
										},
									},
								);
							}}
							className="space-y-4"
						>
							<div className="flex flex-col items-center w-full space-y-4">
								<QRCodeSVG value={qrData.totpURI} className="w-full max-w-[200px]" />
								<div className="w-full space-y-2">
									<p className="text-sm text-muted-foreground">
										{t("If you can't scan the QR code, enter this code:")}
									</p>
									<code className="font-semibold select-all break-all whitespace-pre-wrap text-sm">
										{qrData.totpURI.split("?secret=")[1]?.split("&")[0]}
									</code>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="verify-code">{t("Confirm the 6-digit code from your app")}</Label>
								<InputOTP
									id="verify-code"
									name="code"
									maxLength={6}
									required
									disabled={isLoading}
									className="w-full"
								>
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
						</form>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isLoading}>{t("Cancel")}</AlertDialogCancel>
						<AlertDialogAction type="submit" form="verify-2fa-form" disabled={isLoading}>
							{t("Verify & Continue")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("Delete account")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("Are you sure you want to delete your account? This action cannot be undone.")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<form
						id="delete-account-form"
						onSubmit={async (e) => {
							e.preventDefault();
							setIsLoading(true);

							const formData = new FormData(e.currentTarget);
							const password = formData.get("password") as string | undefined;

							try {
								const { data, error } = await apiClient.POST("/api/users/{id}/delete", {
									params: {
										path: {
											id: userId,
										},
									},
									body: {
										password,
									},
								});

								if (error) {
									const e = error?.error as unknown as { code: string };
									if (e.code === "UNAUTHORIZED") {
										toast.error(t("Invalid password. Please try again."));
									} else {
										toast.error(t("Failed to delete account"));
									}
									setIsLoading(false);
									return;
								}

								if (data?.success) {
									toast.success(t("Account deleted successfully"));
									setShowDeleteDialog(false);
									await authClient.signOut();
									router.push("/login");
								}
							} catch {
								toast.error(t("An error occurred while deleting your account"));
								setIsLoading(false);
							}
						}}
						className="space-y-4"
					>
						{hasPassword && (
							<div className="space-y-2">
								<Label htmlFor="delete-password">{t("Password")}</Label>
								<Input
									id="delete-password"
									name="password"
									type="password"
									placeholder={t("Enter your password")}
									autoComplete="current-password"
									required
									disabled={isLoading}
								/>
							</div>
						)}
					</form>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isLoading}>{t("Cancel")}</AlertDialogCancel>
						<AlertDialogAction
							type="submit"
							form="delete-account-form"
							disabled={isLoading}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{t("Delete account")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
