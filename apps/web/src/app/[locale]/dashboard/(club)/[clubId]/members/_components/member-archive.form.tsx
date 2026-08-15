"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaFooter,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import apiClient from "@/lib/api/api.client";

interface MemberArchiveFormProps {
	clubId: string;
	member: {
		id: string;
		userName: string;
	};
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function MemberArchiveForm({ clubId, member, open, onOpenChange }: MemberArchiveFormProps) {
	const t = useExtracted();
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);

	const archiveSchema = z.object({
		reason: z.enum(["DECEASED", "INACTIVE", "MOVED_AWAY", "RETIRED", "OTHER"], {
			error: t("Please select a reason"),
		}),
		note: z.string().max(500).optional(),
	});

	type ArchiveFormValues = z.infer<typeof archiveSchema>;

	const form = useForm<ArchiveFormValues>({
		resolver: zodResolver(archiveSchema),
		defaultValues: {
			reason: "INACTIVE",
			note: "",
		},
	});

	async function onSubmit(data: ArchiveFormValues) {
		setIsLoading(true);

		try {
			const { error } = await apiClient.POST("/api/clubs/{id}/members/{memberId}/archive", {
				params: {
					path: {
						id: clubId,
						memberId: member.id,
					},
				},
				body: {
					reason: data.reason,
					note: data.note?.trim() ? data.note.trim() : undefined,
				},
			});

			if (error) {
				toast.error(error.error || t("There was an error while archiving the member"));
				return;
			}

			toast.success(t("{user} has been archived", { user: member.userName }));
			form.reset();
			onOpenChange(false);
			router.refresh();
		} catch {
			toast.error(t("There was an error while archiving the member"));
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<Credenza open={open} onOpenChange={onOpenChange}>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{t("Archive member")}</CredenzaTitle>
					<p className="text-sm text-muted-foreground">
						{t(
							"{user} keeps their place in the club's history but loses access. You can bring them back at any time.",
							{ user: member.userName },
						)}
					</p>
				</CredenzaHeader>
				<CredenzaBody>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
							<FormField
								control={form.control}
								name="reason"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("Reason")}</FormLabel>
										<Select onValueChange={field.onChange} defaultValue={field.value}>
											<SelectTrigger>
												<SelectValue placeholder={t("Select a reason")} />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="INACTIVE">{t("No longer active")}</SelectItem>
												<SelectItem value="MOVED_AWAY">{t("Moved away")}</SelectItem>
												<SelectItem value="RETIRED">{t("Retired")}</SelectItem>
												<SelectItem value="DECEASED">{t("Deceased")}</SelectItem>
												<SelectItem value="OTHER">{t("Other")}</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="note"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("Note (optional)")}</FormLabel>
										<FormControl>
											<Textarea
												{...field}
												rows={3}
												maxLength={500}
												placeholder={t("Only managers of this club can see this note.")}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</form>
					</Form>
				</CredenzaBody>

				<CredenzaFooter>
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						{t("Cancel")}
					</Button>
					<Button type="submit" disabled={isLoading} onClick={form.handleSubmit(onSubmit)}>
						{isLoading ? t("Saving...") : t("Archive")}
					</Button>
				</CredenzaFooter>
			</CredenzaContent>
		</Credenza>
	);
}
