"use client";

import { authClient } from "@auth/client";
import { Button } from "@components/ui/button";
import type { Session } from "@generated/client";
import type { Passkey } from "better-auth/plugins/passkey";
import { formatDate, formatDistanceToNow } from "date-fns";
import { bs } from "date-fns/locale";
import { Dice5, Download, KeyRound, Laptop, ShieldQuestion, Smartphone, Tablet, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { PasswordChangeForm } from "@/app/[locale]/dashboard/(user)/user/security/_components/password-change.form";
import { SetupPasswordForm } from "@/app/[locale]/dashboard/(user)/user/security/_components/password-setup.form";
import { BadgeSoon } from "@/components/badge-soon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePrompt } from "@/components/ui/alert-dialog-provider";
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
	const t = useTranslations();

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
							<AlertTitle>{passkey.name ?? "Passkey"}</AlertTitle>
							<AlertDescription>
								{/* Kreiran{" "}
								{passkey.createdAt &&
									formatDate(passkey.createdAt, "dd.MM.yyyy")} */}
								{t("createdAt", {
									date: passkey.createdAt && formatDate(passkey.createdAt, "dd.MM.yyyy"),
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
						<AlertTitle>{t("dashboard.security.securitySettings.addNewPasskey")}</AlertTitle>
						<AlertDescription>
							{t("dashboard.security.securitySettings.addNewPasskeyDescription")}
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
						{t("dashboard.security.securitySettings.add")}
						<BadgeSoon />
					</Button>
				</Alert>
			</div>
			<div className="flex flex-col gap-1">
				<h3 className="text-lg font-semibold">{t("dashboard.security.securitySettings.twoFactor")}</h3>
			</div>
			{!hasPassword && (
				<Alert className="flex flex-col gap-1">
					<AlertTitle>{t("dashboard.security.securitySettings.twoFactorUnavailable")}</AlertTitle>
					<AlertDescription>
						{t("dashboard.security.securitySettings.twoFactorUnavailableDescription")}
					</AlertDescription>
				</Alert>
			)}
			{hasPassword && (
				<div className="space-y-2">
					{hasTwoFactor ? (
						<>
							<Alert className="flex flex-col md:flex-row gap-1 justify-between -z-0">
								<div className="flex flex-col">
									<AlertTitle>{t("dashboard.security.securitySettings.twoFactorDisable")}</AlertTitle>
									<AlertDescription>
										{t("dashboard.security.securitySettings.twoFactorDisableDescription")}
									</AlertDescription>
								</div>
								<Button
									type="button"
									variant="destructive"
									disabled={isLoading}
									className="w-full md:w-auto"
									onClick={async () => {
										const confirmed = await prompt({
											cancelButton: t("common.actions.cancel"),
											cancelButtonVariant: "ghost",
											title: t(
												"dashboard.security.securitySettings.twoFactorDisablePrompt.title",
											),
											body: t("dashboard.security.securitySettings.twoFactorDisablePrompt.body"),
											actionButton: t("common.actions.disable"),
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
													toast.error(
														t(
															"dashboard.security.securitySettings.twoFactorDisablePrompt.invalidPassword",
														),
													);
												},
											},
										);
									}}
								>
									{t("dashboard.security.securitySettings.disable")}
								</Button>
							</Alert>
							{!hasBackupCodes ? (
								<Alert className="flex flex-col gap-1">
									<AlertTitle className="flex items-center gap-4 justify-between">
										<span>{t("dashboard.security.securitySettings.backupCodes")}</span>
										<Button
											type="button"
											variant="outline"
											disabled={isLoading}
											onClick={async () => {
												const confirmed = await prompt({
													title: t("dashboard.security.securitySettings.regenerate"),
													body: t(
														"dashboard.security.securitySettings.regenerateDescription",
													),
													cancelButton: t(
														"dashboard.security.securitySettings.regenerateCancel",
													),
													actionButton: t(
														"dashboard.security.securitySettings.regenerateConfirm",
													),
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
															toast.success(
																t(
																	"dashboard.security.securitySettings.regenerateSuccess",
																),
															);
														},
														onError: () => {
															setIsLoading(false);
															toast.error(
																t(
																	"dashboard.security.securitySettings.regenerateError",
																),
															);
														},
													},
												);
											}}
										>
											<Dice5 className="w-4 h-4 mr-2" />
											{t("dashboard.security.securitySettings.regenerate")}
										</Button>
									</AlertTitle>
									<AlertDescription>
										{t("dashboard.security.securitySettings.backupCodesNotVisible")}
									</AlertDescription>
								</Alert>
							) : (
								<Alert className="flex flex-col gap-1">
									<AlertTitle className="flex items-center gap-2 justify-between">
										<span>{t("dashboard.security.securitySettings.backupCodes")}</span>
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
													a.download = "rezervni-kodovi.txt";
													a.click();
													window.URL.revokeObjectURL(url);
												}}
											>
												<Download className="w-4 h-4 mr-2" />
												{t("dashboard.security.securitySettings.download")}
											</Button>
											<Button
												type="button"
												variant="outline"
												onClick={async () => {
													const confirmed = await prompt({
														title: t("dashboard.security.securitySettings.regenerate"),
														body: t(
															"dashboard.security.securitySettings.regenerateDescription",
														),
														cancelButton: t(
															"dashboard.security.securitySettings.regenerateCancel",
														),
														actionButton: t(
															"dashboard.security.securitySettings.regenerateConfirm",
														),
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
																toast.success(
																	t(
																		"dashboard.security.securitySettings.regenerateSuccess",
																	),
																);
															},
															onError: () => {
																setIsLoading(false);
																toast.error(
																	t(
																		"dashboard.security.securitySettings.regenerateError",
																	),
																);
															},
														},
													);
												}}
											>
												<Dice5 className="w-4 h-4 mr-2" />
												{t("dashboard.security.securitySettings.regenerate")}
											</Button>
										</div>
									</AlertTitle>
									<AlertDescription>
										{t("dashboard.security.securitySettings.regenerateDescription")}
									</AlertDescription>
									<div className="bg-background border p-4 mt-2 flex flex-wrap gap-2">
										{displayBackupCodes?.map((code) => (
											<code
												onClick={() => {
													navigator.clipboard.writeText(code);
													toast.success("Kopirano u clipboard.");
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
								<AlertTitle>{t("dashboard.security.securitySettings.twoFactorEnable")}</AlertTitle>
								<AlertDescription>
									{t("dashboard.security.securitySettings.twoFactorEnableDescription")}
								</AlertDescription>
							</div>
							<Button
								type="button"
								disabled={isLoading}
								className="w-full md:w-auto"
								onClick={async () => {
									const password = await prompt({
										cancelButton: t("common.actions.cancel"),
										cancelButtonVariant: "ghost",
										title: t("dashboard.security.securitySettings.twoFactorEnablePrompt.title"),
										body: t("dashboard.security.securitySettings.twoFactorEnablePrompt.body"),
										actionButton: t("common.actions.confirm"),
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
												toast.error("Neispavna lozinka, pokušajte ponovo.");
											},
										},
									);

									if (resp?.error) {
										return;
									}

									const confirmed = await prompt({
										cancelButton: t("common.actions.cancel"),
										cancelButtonVariant: "ghost",
										title: t("dashboard.security.securitySettings.twoFactorEnablePrompt.title"),
										body: (
											<div className="space-y-2">
												<p>
													{t(
														"dashboard.security.securitySettings.twoFactorConfirmPrompt.scanQr",
													)}
												</p>
												<div className="w-fit flex flex-col items-center w-full">
													<QRCodeSVG value={resp.data.totpURI} className="w-full" />
													<p className="mt-2 w-full text-left">
														{t(
															"dashboard.security.securitySettings.twoFactorConfirmPrompt.enterCode",
														)}
													</p>
													<code className="font-semibold select-all break-all whitespace-pre-wrap">
														{resp.data.totpURI.split("?secret=")[1]?.split("&")[0]}
													</code>
												</div>
												<span className="block mt-2">
													{t(
														"dashboard.security.securitySettings.twoFactorConfirmPrompt.verifyCode",
													)}
												</span>
											</div>
										),
										actionButton: t("common.actions.enable"),
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
												toast.error(
													t(
														"dashboard.security.securitySettings.twoFactorConfirmPrompt.invalidCode",
													),
												);
											},
										},
									);
								}}
							>
								{t("dashboard.security.securitySettings.twoFactorConfirmPrompt.confirm")}
							</Button>
						</Alert>
					)}
				</div>
			)}
			<div className="flex flex-col gap-1">
				<h3 className="text-lg font-semibold">{t("dashboard.security.securitySettings.activeSessions")}</h3>
				<p className="text-sm text-muted-foreground">
					{t("dashboard.security.securitySettings.activeSessionsDescription")}
				</p>
			</div>
			{sessions.length > 1 && (
				<Alert>
					<AlertDescription className="flex justify-between items-center">
						<span>{t("dashboard.security.securitySettings.logoutAll")}</span>
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
											toast.success(t("dashboard.security.securitySettings.logoutAllSuccess"));
										},
										onError: () => {
											setIsLoading(false);
											toast.error(t("dashboard.security.securitySettings.logoutAllError"));
										},
									},
								);
							}}
						>
							{t("dashboard.security.securitySettings.logoutAllAction")}
						</Button>
					</AlertDescription>
				</Alert>
			)}
			<ScrollArea className="max-h-[400px] border overflow-y-auto">
				<div className="p-4 space-y-2">
					{sessions.map((session) => {
						const Icon = getDeviceIcon(session.userAgent ?? undefined);
						return (
							<Alert
								key={session.id}
								className={cn("flex flex-col md:flex-row gap-1 justify-between -z-0", {
									"bg-primary/10": session.isCurrentSession,
								})}
							>
								<div className="flex gap-4 items-center">
									<Icon className="w-8 h-8" />
									<div className="flex flex-col">
										<AlertTitle className="flex items-center gap-2">
											{session.userAgent?.split("/")[0] || "Nepoznat uređaj"}
											{session.isCurrentSession && (
												<span className="text-xs border bg-background text-primary px-2 py-1">
													{t("dashboard.security.securitySettings.currentSession")}
												</span>
											)}
										</AlertTitle>
										<AlertDescription>
											{session.ipAddress && (
												<span className="block text-xs">IP: {session.ipAddress}</span>
											)}
											<span className="block text-xs">
												{t("dashboard.security.securitySettings.sessionLastUsed", {
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
														toast.success(
															t(
																"dashboard.security.securitySettings.logoutSingleSuccess",
															),
														);
													},
													onError: () => {
														setIsLoading(false);
														toast.error(
															t("dashboard.security.securitySettings.logoutSingleError"),
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
