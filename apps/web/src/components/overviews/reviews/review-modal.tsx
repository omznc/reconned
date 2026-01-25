"use client";

import { useState } from "react";
import { useExtracted } from "next-intl";
import { Star } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Credenza, CredenzaBody, CredenzaClose, CredenzaContent, CredenzaDescription, CredenzaFooter, CredenzaHeader, CredenzaTitle } from "@/components/ui/credenza";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/api.client";
import { toast } from "sonner";

interface ReviewModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	type: "USER" | "CLUB" | "EVENT";
	entityId: string;
	entityName: string;
}

export function ReviewModal({ open, onOpenChange, type, entityId, entityName }: ReviewModalProps) {
	const t = useExtracted();
	const queryClient = useQueryClient();
	const [hoveredRating, setHoveredRating] = useState(0);

	const formSchema = z.object({
		rating: z.number().int().min(1).max(5),
		content: z.string().min(1, t("Review content is required")).max(5000, t("Review content must be less than 5000 characters")),
	});

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			rating: 0,
			content: "",
		},
	});

	const createReviewMutation = useMutation({
		mutationFn: async (values: z.infer<typeof formSchema>) => {
			const body = {
				type,
				rating: values.rating,
				content: values.content,
			} as { type: typeof type; rating: number; content: string; userId?: string; clubId?: string; eventId?: string };

			if (type === "USER") {
				body.userId = entityId;
			} else if (type === "CLUB") {
				body.clubId = entityId;
			} else if (type === "EVENT") {
				body.eventId = entityId;
			}

			const { error } = await apiClient.POST("/reviews", { body });
			if (error) {
				throw error;
			}
			return error;
		},
		onSuccess: () => {
			toast.success(t("Review submitted successfully"));
			form.reset();
			onOpenChange(false);
			queryClient.invalidateQueries({ queryKey: [["reviews", type, entityId]] });
		},
		onError: (error) => {
			console.error("Error submitting review:", error);
			const errorDetail = error && typeof error === "object" && "detail" in error ? (error as { detail: string }).detail : undefined;
			const errorMessage =
				errorDetail === "You can only review events that have finished"
					? t("You can only review events that have finished")
					: errorDetail === "You can only review events you attended"
						? t("You can only review events you attended")
						: errorDetail === "You cannot review yourself"
							? t("You cannot review yourself")
							: t("Failed to submit review. Please try again.");
			toast.error(errorMessage);
		},
	});

	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		createReviewMutation.mutate(values);
	};

	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) {
			form.reset();
			setHoveredRating(0);
		}
		onOpenChange(newOpen);
	};

	return (
		<Credenza open={open} onOpenChange={handleOpenChange}>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>
						{type === "USER" && t("Review User")}
						{type === "CLUB" && t("Review Club")}
						{type === "EVENT" && t("Review Event")}
					</CredenzaTitle>
					<CredenzaDescription>
						{type === "USER" && t("Leave a review for {name}", { name: entityName })}
						{type === "CLUB" && t("Leave a review for {name}", { name: entityName })}
						{type === "EVENT" && t("Leave a review for {name}", { name: entityName })}
					</CredenzaDescription>
				</CredenzaHeader>
				<CredenzaBody>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
							<FormField
								control={form.control}
								name="rating"
								render={({ field }) => (
									<FormItem>
										<div className="space-y-2">
											<div className="flex gap-1">
												{[1, 2, 3, 4, 5].map((star) => (
													<button
														key={star}
														type="button"
														className="p-1 hover:scale-110 transition-transform"
														onClick={() => field.onChange(star)}
														onMouseEnter={() => setHoveredRating(star)}
														onMouseLeave={() => setHoveredRating(0)}
													>
														<Star
															className={`h-8 w-8 ${
																(hoveredRating || field.value) >= star
																	? "fill-yellow-400 text-yellow-400"
																	: "fill-muted text-muted"
															} transition-colors`}
														/>
													</button>
												))}
											</div>
											<FormMessage />
										</div>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="content"
								render={({ field }) => (
									<FormItem>
										<FormControl>
											<Textarea
												placeholder={t("Share your experience...")}
												className="resize-none"
												rows={6}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<CredenzaFooter>
								<CredenzaClose asChild>
									<Button type="button" variant="outline">
										{t("Cancel")}
									</Button>
								</CredenzaClose>
								<Button type="submit" disabled={createReviewMutation.isPending}>
									{createReviewMutation.isPending ? t("Submitting...") : t("Submit Review")}
								</Button>
							</CredenzaFooter>
						</form>
					</Form>
				</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}
