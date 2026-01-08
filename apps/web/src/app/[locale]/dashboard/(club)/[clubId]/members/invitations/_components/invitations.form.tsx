"use client";

import { Button } from "@components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@components/ui/command";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@components/ui/form";
import { Input } from "@components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Loader } from "@/components/loader";
import { useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import { cn } from "@/lib/utils";

export function InvitationsForm() {
	const params = useParams<{ clubId: string }>();
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const router = useRouter();
	const t = useExtracted();

	const sendInvitationSchema = z.object({
		clubId: z.string(),
		userEmail: z.string(),
		userName: z.string().optional(),
	});

	const form = useForm<z.infer<typeof sendInvitationSchema>>({
		resolver: zodResolver(sendInvitationSchema),
		defaultValues: {
			clubId: params.clubId,
			userName: "",
			userEmail: "",
		},
	});

	const { data: users = [], isLoading } = useQuery({
		queryKey: ["users", searchQuery],
		queryFn: async () => {
			if (searchQuery.length < 2) return [];
			const { data, error } = await apiClient.GET("/api/users", {
				params: {
					query: {
						search: searchQuery,
						perPage: 10,
					},
				},
			});
			if (error) throw new Error("Failed to search users");
			return data.users;
		},
		enabled: searchQuery.length >= 2,
	});

	const handleSearch = (value: string) => {
		setSearchQuery(value);
	};

	async function onSubmit(values: z.infer<typeof sendInvitationSchema>) {
		try {
			const { error } = await apiClient.POST("/api/clubs/{id}/invites", {
				params: {
					path: {
						id: values.clubId,
					},
				},
				body: {
					userEmail: values.userEmail,
					userName: values.userName,
				},
			});

			if (error) {
				throw new Error(error.error || t("An error occurred while sending the invitation. Please try again."));
			}

			toast.success(t("Invitation sent successfully"));
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: t("An error occurred while sending the invitation. Please try again.");
			toast.error(message);
		} finally {
			form.reset({ userName: "", userEmail: "", clubId: params.clubId });
			router.refresh();
		}
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-full">
				<div>
					<h3 className="text-lg font-semibold">{t("Invite user to club")}</h3>
					<span className="text-muted-foreground">
						{t("Invitations will expire after 7 days, and will be deleted after 3 months.")}
					</span>
				</div>
				<FormField
					control={form.control}
					name="userName"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>{t("User")}</FormLabel>
							<Popover open={open} onOpenChange={setOpen}>
								<PopoverTrigger asChild>
									<FormControl>
										<Button
											variant="outline"
											aria-expanded={open}
											className={cn(
												"w-full justify-between",
												!field.value && "text-muted-foreground",
											)}
										>
											{field.value
												? users.find((user) => user.id === field.value)?.name
												: t("Search users...")}
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</FormControl>
								</PopoverTrigger>
								<PopoverContent className="sm:w-[448px] p-0">
									<Command shouldFilter={false}>
										<CommandInput
											placeholder={t("Search users...")}
											value={searchQuery}
											onValueChange={handleSearch}
										/>
										<CommandList>
											{isLoading ? (
												<CommandEmpty className="flex items-center justify-center size-full p-4">
													<Loader size={24} />
												</CommandEmpty>
											) : searchQuery.length < 2 ? (
												<CommandEmpty>{t("Enter at least 2 characters")}</CommandEmpty>
											) : users.length === 0 ? (
												<CommandEmpty>{t("No results")}</CommandEmpty>
											) : (
												<CommandGroup>
													{users.map((user) => (
														<CommandItem
															key={user.id}
															value={user.id}
															onSelect={() => {
																form.setValue("userName", user.name, {
																	shouldDirty: true,
																});
																form.setValue("userEmail", user.email || "", {
																	shouldDirty: true,
																});
																setOpen(false);
															}}
														>
															<div className="flex justify-between w-full items-center">
																<div className="flex flex-col">
																	<span>{user.name}</span>
																	<span className="text-sm text-muted-foreground">
																		{user.email}
																	</span>
																	{user.clubMembership &&
																		user.clubMembership.length > 0 && (
																			<span className="text-xs text-muted-foreground">
																				{t("Member of")}:{" "}
																				{user.clubMembership
																					.map((m) => m.club.name)
																					.join(", ")}
																			</span>
																		)}
																</div>
																<Check
																	className={cn(
																		"ml-auto h-4 w-4",
																		user.id === field.value
																			? "opacity-100"
																			: "opacity-0",
																	)}
																/>
															</div>
														</CommandItem>
													))}
												</CommandGroup>
											)}
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
							<FormDescription>
								{t("If the user is already on the platform, you can find them here.")}
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<div className="flex gap-1 items-center">
					<hr className="flex-1 border-t-2 border-gray-300" />
					<span className="text-gray-500">{t("or")}</span>
					<hr className="flex-1 border-t-2 border-gray-300" />
				</div>
				<FormField
					control={form.control}
					name="userEmail"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Email</FormLabel>
							<FormControl>
								<Input {...field} />
							</FormControl>
							<FormDescription>
								{t("If you can't find the user, or already know their email, enter it here.")}
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
					{t("Send invitation")}
				</Button>
			</form>
		</Form>
	);
}
