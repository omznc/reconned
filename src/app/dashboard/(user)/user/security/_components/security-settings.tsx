"use client";

import { PasswordChangeForm } from "@/app/dashboard/(user)/user/security/_components/password-change-form";
import { SetupPasswordForm } from "@/app/dashboard/(user)/user/security/_components/setup-password-form";
import { authClient } from "@auth/client";
import { Button } from "@components/ui/button";
import type { Passkey } from "@prisma/client";
import { formatDate } from "date-fns";
import { KeyRound, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SecuritySettings({
	passkeys,
	hasPassword,
}: { passkeys: Passkey[]; hasPassword: boolean }) {
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();

	return (
		<>
			{hasPassword ? (
				<PasswordChangeForm isLoading={isLoading} setIsLoading={setIsLoading} />
			) : (
				<SetupPasswordForm isLoading={isLoading} setIsLoading={setIsLoading} />
			)}
			<div>
				<h3 className="text-lg font-semibold">Passkey</h3>
			</div>
			<div className="space-y-2">
				{passkeys.map((passkey) => (
					<div
						key={passkey.id}
						className="flex items-center space-x-2 p-2 px-4 bg-sidebar border"
					>
						<span className="text-sm ">
							{passkey.name ?? "Passkey"} -{" "}
							{passkey.createdAt && formatDate(passkey.createdAt, "dd.MM.yyyy")}
						</span>
						<Button
							type="button"
							variant="ghost"
							className="hover:bg-transparent"
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
					</div>
				))}
			</div>
			<p className="text-sm text-muted-foreground">
				<Button
					type="button"
					className="w-full"
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
					Dodaj novi passkey
				</Button>
			</p>
		</>
	);
}
