"use client";

import { passwordSchema } from "@/app/dashboard/(user)/user/security/_components/password-change-schema";
import { authClient } from "@auth/client";
import { Button } from "@components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@components/ui/form";
import { Input } from "@components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Passkey } from "@prisma/client";
import { LockIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

export function SecuritySettings({ passkeys }: { passkeys: Passkey[] }) {
	const [isLoading, setIsLoading] = useState(false);

	const form = useForm<z.infer<typeof passwordSchema>>({
		resolver: zodResolver(passwordSchema),
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
	});

	const onSubmit = async (values: z.infer<typeof passwordSchema>) => {
		setIsLoading(true);
		try {
			await authClient.user.changePassword({
				currentPassword: values.currentPassword,
				newPassword: values.newPassword,
			});
			toast.error("Vaša lozinka je uspješno promijenjena.");
			form.reset();
		} catch (_e) {
			toast(
				"Došlo je do greške prilikom promjene lozinke. Molimo pokušajte ponovo.",
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="p-6 space-y-6">
			<h2 className="text-2xl font-bold">Sigurnost</h2>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<h3 className="text-lg font-medium">Promijeni lozinku</h3>
					<FormField
						control={form.control}
						name="currentPassword"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Trenutna lozinka</FormLabel>
								<FormControl>
									<Input type="password" disabled={isLoading} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="newPassword"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Nova lozinka</FormLabel>
								<FormControl>
									<Input type="password" disabled={isLoading} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="confirmPassword"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Potvrdi novu lozinku</FormLabel>
								<FormControl>
									<Input type="password" disabled={isLoading} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
					<Button type="submit" className="w-full" disabled={isLoading}>
						<LockIcon className="w-4 h-4 mr-2" />
						{isLoading ? "Mijenjanje lozinke..." : "Promijeni lozinku"}
					</Button>
				</form>
			</Form>

			<h3 className="text-lg font-medium">Passkey</h3>
			<div className="space-y-2">
				{passkeys.map((passkey) => (
					<div key={passkey.id} className="flex items-center space-x-2">
						<span className="text-sm font-semibold">
							{passkey.name} - {passkey.createdAt?.toISOString()}
						</span>
						<Button
							type="button"
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
										},
										onError: () => {
											setIsLoading(false);
										},
									},
								);
							}}
						>
							Delete
						</Button>
					</div>
				))}
			</div>
			<p className="text-sm text-muted-foreground">
				<Button
					type="button"
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
								},
								onError: () => {
									setIsLoading(false);
								},
							},
						);
					}}
				>
					Dodaj novi passkey
				</Button>
			</p>
		</div>
	);
}
