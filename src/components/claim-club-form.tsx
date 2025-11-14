"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Info, LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { claimClubRequest } from "@/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/unclaimed-clubs.actions";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";

const claimClubSchema = z.object({
	message: z.string().optional(),
});

interface ClaimClubFormProps {
	clubId: string;
	clubName: string;
	user?: { id: string; name: string; email: string; callsign?: string | null } | null;
}

export function ClaimClubForm({ clubId, user }: ClaimClubFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const t = useTranslations();

	const form = useForm<z.infer<typeof claimClubSchema>>({
		resolver: zodResolver(claimClubSchema),
		defaultValues: {
			message: "",
		},
	});

	async function onSubmit(values: z.infer<typeof claimClubSchema>) {
		setIsLoading(true);
		try {
			const result = await claimClubRequest({
				clubId,
				message: values.message,
			});

			if (result?.data?.success) {
				toast.success(t("components.claimClubForm.success"));
				setSubmitted(true);
				form.reset();
			} else {
				throw new Error();
			}
		} catch {
			toast.error(t("components.claimClubForm.error"));
		} finally {
			setIsLoading(false);
		}
	}

	if (!user) {
		return (
			<div className="space-y-4">
				<Alert>
					<Info className="h-4 w-4" />
					<AlertDescription>{t("components.claimClubForm.disclaimer")}</AlertDescription>
				</Alert>
				<Alert>
					<LogIn className="h-4 w-4" />
					<AlertDescription>{t("components.claimClubForm.loginRequired")}</AlertDescription>
					<div className="mt-4">
						<Button asChild>
							<Link href="/login">{t("components.claimClubForm.login")}</Link>
						</Button>
					</div>
				</Alert>
			</div>
		);
	}

	if (submitted) {
		return (
			<Alert>
				<Info className="h-4 w-4" />
				<AlertDescription>{t("components.claimClubForm.submitted")}</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-4">
			<Alert>
				<Info className="h-4 w-4" />
				<AlertDescription>{t("components.claimClubForm.disclaimer")}</AlertDescription>
			</Alert>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<FormField
						control={form.control}
						name="message"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("components.claimClubForm.message")}</FormLabel>
								<FormControl>
									<Textarea
										placeholder={t("components.claimClubForm.messagePlaceholder")}
										{...field}
									/>
								</FormControl>
								<FormDescription>{t("components.claimClubForm.messageDescription")}</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<LoaderSubmitButton isLoading={isLoading}>
						{t("components.claimClubForm.submit")}
					</LoaderSubmitButton>
				</form>
			</Form>
		</div>
	);
}
