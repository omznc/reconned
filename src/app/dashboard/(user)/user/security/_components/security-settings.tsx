"use client";

import { PasswordChangeForm } from "@/app/dashboard/(user)/user/security/_components/password-change-form";
import { SetupPasswordForm } from "@/app/dashboard/(user)/user/security/_components/setup-password-form";
import { BadgeSoon } from "@/components/badge-soon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePrompt } from "@/components/ui/alert-dialog-provider";
import { Label } from "@/components/ui/label";
import { authClient } from "@auth/client";
import { Button } from "@components/ui/button";
import type { Passkey } from "@prisma/client";
import { formatDate } from "date-fns";
import { Dice1, Dice5, Download, KeyRound, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";

export function SecuritySettings({
	passkeys,
	hasPassword,
	hasTwoFactor,
	backupCodes,
}: {
	passkeys: Passkey[];
	hasPassword: boolean;
	hasTwoFactor?: boolean | null;
	backupCodes?: string[] | null;
}) {
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();
	const prompt = usePrompt();

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
					<Alert
						key={passkey.id}
						className="flex flex-col md:flex-row gap-1 justify-between -z-0"
					>
						<div className="flex flex-col">
							<AlertTitle>{passkey.name ?? "Passkey"}</AlertTitle>
							<AlertDescription>
								Kreiran{" "}
								{passkey.createdAt &&
									formatDate(passkey.createdAt, "dd.MM.yyyy")}
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
						<AlertTitle>Dodaj novi passkey</AlertTitle>
						<AlertDescription>
							Dodajte novi passkey za brže i sigurnije prijavljivanje na vaš
							račun.
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
						Dodaj
					</Button>
				</Alert>
			</div>
			<div className="flex flex-col gap-1">
				<h3 className="text-lg font-semibold">2-faktorska autentikacija</h3>
			</div>
			{
				!hasPassword && (
					<Alert className="flex flex-col gap-1">
						<AlertTitle>2-faktorska autentikacija nije dostupna</AlertTitle>
						<AlertDescription>
							Da biste koristili 2-faktorsku autentikaciju, morate prvo postaviti
							lozinku.
						</AlertDescription>
					</Alert>
				)
			}
			{hasPassword && (
				<div className="space-y-2">
					{hasTwoFactor ? (
						<>
							<Alert className="flex flex-col md:flex-row gap-1 justify-between -z-0">
								<div className="flex flex-col">
									<AlertTitle>Isključi 2-faktorsku autentikaciju</AlertTitle>
									<AlertDescription>
										Ukoliko isključite 2-faktorsku autentikaciju, bićete u
										mogućnosti da se prijavite na vaš nalog bez potvrde putem
										aplikacije.
									</AlertDescription>
								</div>
								<Button
									type="button"
									variant="destructive"
									disabled={isLoading}
									className="w-full md:w-auto"
									onClick={async () => {
										const confirmed = await prompt({
											cancelButton: "Otkaži",
											cancelButtonVariant: "ghost",
											title: "Isključi 2-faktorsku autentikaciju",
											body: "Da li ste sigurni da želite isključiti 2-faktorsku autentikaciju? Ako jeste, upišite svoju lozinku.",
											actionButton: "Isključi",
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
													toast.error("Neispavna lozinka, pokušajte ponovo.");
												},
											},
										);
									}}
								>
									Isključi
								</Button>
							</Alert>
							<Alert className="flex flex-col gap-1">
								<AlertTitle className="flex items-center justify-between">
									<span>Rezervni kodovi</span>
									<div className="flex gap-2">
										<Button
											type="button"
											variant="outline"
											disabled={isLoading}
											onClick={() => {
												const text = backupCodes?.join('\n') ?? '';
												const blob = new Blob([text], { type: 'text/plain' });
												const url = window.URL.createObjectURL(blob);
												const a = document.createElement('a');
												a.href = url;
												a.download = 'rezervni-kodovi.txt';
												a.click();
												window.URL.revokeObjectURL(url);
											}}
										>
											<Download className="w-4 h-4 mr-2" />
											Preuzmi kao txt
										</Button>
										<Button
											type="button"
											variant="outline"
											disabled={true}
											onClick={async () => {
												const confirmed = await prompt({
													title: "Regeneriši rezervne kodove",
													body: "Da li ste sigurni da želite regenerisati rezervne kodove? Ako jeste, upišite svoju lozinku. Stari kodovi će biti poništeni.",
													cancelButton: "Otkaži",
													actionButton: "Regeneriši",
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
														onSuccess: () => {
															setIsLoading(false);
															router.refresh();
															toast.success("Rezervni kodovi su regenerisani.");
														},
														onError: () => {
															setIsLoading(false);
															toast.error("Neispravna lozinka ili druga greška.");
														},
													}
												);
											}}
										>
											<Dice5 className="w-4 h-4 mr-2" />
											Regeneriši kodove
											<BadgeSoon />
										</Button>
									</div>
								</AlertTitle>
								<AlertDescription>
									Ovo su vaši rezervni kodovi za 2-faktorsku autentikaciju. Svaki kod možete iskoristiti samo jednom.
									Sačuvajte ih na sigurno mjesto.
								</AlertDescription>
								<div className="bg-background border p-4 mt-2 flex flex-wrap gap-2">
									{backupCodes?.map((code) => (
										<code
											onClick={() => {
												navigator.clipboard.writeText(code);
												toast.success("Kopirano u clipboard.");
											}}
											key={code}
											className="flex-grow cursor-pointer text-center bg-sidebar md:blur-[3px] hover:blur-0 transition-all p-2 font-mono">
											{code}
										</code>
									))}
								</div>
							</Alert>
						</>
					) : (
						<Alert className="flex flex-col md:flex-row gap-1 justify-between -z-0">
							<div className="flex flex-col">
								<AlertTitle>Uključi 2-faktorsku autentikaciju</AlertTitle>
								<AlertDescription>
									Uključite 2-faktorsku autentikaciju na vaš nalog kako biste
									dodali dodatni sloj sigurnosti.
								</AlertDescription>
							</div>
							<Button
								type="button"
								disabled={isLoading}
								className="w-full md:w-auto"
								onClick={async () => {
									const password = await prompt({
										cancelButton: "Otkaži",
										cancelButtonVariant: "ghost",
										title: "Uključi 2-faktorsku autentikaciju",
										body: "Da li ste sigurni da želite uključiti 2-faktorsku autentikaciju? Ako jeste, upišite svoju lozinku.",
										actionButton: "Uključi",
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
										cancelButton: "Otkaži",
										cancelButtonVariant: "ghost",
										title: "Uključi 2-faktorsku autentikaciju",
										body: (
											<div className="space-y-2">
												<p>
													Skenirajte QR kod sa vašom aplikacijom za
													2-faktorsku autentikaciju.
												</p>
												<div className="bg-white p-2 w-fit">
													<QRCodeSVG value={resp.data.totpURI} />
												</div>
												<p>
													Ukoliko ne možete skenirati QR kod, upišite ovaj kod
													u vašu aplikaciju:
												</p>
												<code className="font-semibold">
													{
														resp.data.totpURI
															.split("?secret=")[1]
															?.split("&")[0]
													}
												</code>
												<span className="block mt-2">
													Unesite kod sa vaše aplikacije za 2-faktorsku
													autentikaciju:
												</span>
											</div>
										),
										actionButton: "Uključi",
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
												toast.error("Neispavan kod, pokušajte ponovo.");
											},
										},
									);
								}}
							>
								Uključi
							</Button>
						</Alert>
					)}
				</div>
			)}
		</>
	);
}
