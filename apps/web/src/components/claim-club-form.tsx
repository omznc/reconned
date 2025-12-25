"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Info, LogIn } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";

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
	const t = useExtracted();

	const form = useForm<z.infer<typeof claimClubSchema>>({
		resolver: zodResolver(claimClubSchema),
		defaultValues: {
			message: "",
		},
	});

	async function onSubmit(values: z.infer<typeof claimClubSchema>) {
		setIsLoading(true);
		try {
			const { data, error } = await apiClient.POST("/api/clubs/{id}/claim-request", {
				params: {
					path: {
						id: clubId,
					},
				},
				body: {
					message: values.message,
				},
			});

			if (!error && data?.success) {
				toast.success(
					t("Claim request submitted successfully. We'll review your request and get back to you soon."),
				);
				setSubmitted(true);
				form.reset();
			} else {
				throw new Error();
			}
		} catch {
			toast.error(t("Failed to submit claim request. Please try again."));
		} finally {
			setIsLoading(false);
		}
	}

	if (!user) {
		return (
			<div className="space-y-4">
				<Alert>
					<Info className="h-4 w-4" />
					<AlertDescription>
						{t(
							"This club was added by the RECONNED team and is not owned by anyone yet. If you are the owner or representative of this club, you can claim it by filling out the form below.",
						)}
					</AlertDescription>
				</Alert>
				<Alert>
					<LogIn className="h-4 w-4" />
					<AlertDescription>
						{t("You must be logged in to submit a claim request. Please log in to continue.")}
					</AlertDescription>
					<div className="mt-4">
						<Button asChild>
							<Link href="/login">{t("Log in")}</Link>
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
				<AlertDescription>
					{t("Your claim request has been submitted. We'll review it and get back to you soon.")}
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-4">
			<Alert>
				<Info className="h-4 w-4" />
				<AlertDescription>
					{t(
						"This club was added by the RECONNED team and is not owned by anyone yet. If you are the owner or representative of this club, you can claim it by filling out the form below.",
					)}
				</AlertDescription>
			</Alert>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<FormField
						control={form.control}
						name="message"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("Message")}</FormLabel>
								<FormControl>
									<Textarea
										placeholder={t("Tell us why you should be the owner of this club...")}
										{...field}
									/>
								</FormControl>
								<FormDescription>
									{t(
										"Optional: Provide additional information about your relationship with this club.",
									)}
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<LoaderSubmitButton isLoading={isLoading}>{t("Submit claim request")}</LoaderSubmitButton>
				</form>
			</Form>
		</div>
	);
}
