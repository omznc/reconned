"use client";

import { sendInvitation } from "@/app/[locale]/dashboard/(club)/[clubId]/members/invitations/_components/invitations.action";
import { sendInvitationSchema } from "@/app/[locale]/dashboard/(club)/[clubId]/members/invitations/_components/invitations.schema";
import { cn } from "@/lib/utils";
import { Button } from "@components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@components/ui/command";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@components/ui/form";
import { Input } from "@components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover";
import { zodResolver } from "@hookform/resolvers/zod";
import debounce from "lodash/debounce";
import { Check, ChevronsUpDown, Loader } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { useRouter } from "@/i18n/navigation";

type SearchUser = {
	id: string;
	email: string;
	name: string;
	image: string | null;
	callsign: string | null;
	clubMembership: {
		club: {
			name: string;
		};
	}[];
};

async function searchUsers(query: string) {
	const response = await fetch(`/api/users?query=${encodeURIComponent(query)}`);
	if (!response.ok) {
		throw new Error("Failed to fetch users");
	}
	return (await response.json()) as SearchUser[];
}

export function InvitationsForm() {
	const params = useParams<{ clubId: string }>();
	const [users, setUsers] = useState<SearchUser[]>([]);
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();
	const t = useTranslations("dashboard.club.members.invitations");

	const form = useForm<z.infer<typeof sendInvitationSchema>>({
		resolver: zodResolver(sendInvitationSchema),
		defaultValues: {
			clubId: params.clubId,
			userName: "",
			userEmail: "",
		},
	});

	const debouncedSearch = useCallback(
		debounce(async (value: string) => {
			if (value.length >= 2) {
				setIsLoading(true);
				try {
					const results = await searchUsers(value);
					setUsers(results);
				} catch (_error) {
					toast.error(t("searchError"));
				} finally {
					setIsLoading(false);
				}
			} else {
				setUsers([]);
			}
		}, 400),
		[],
	);

	const handleSearch = (value: string) => {
		setSearchQuery(value);
		debouncedSearch(value);
	};

	async function onSubmit(values: z.infer<typeof sendInvitationSchema>) {
		try {
			const response = await sendInvitation(values);

			if (!response?.data?.success) {
				toast.error(response?.data?.error || t("sendError"));
				return;
			}

			toast.success(t("sendSuccess"));
		} catch (_error) {
			toast.error(t("sendError"));
		} finally {
			form.reset({ userName: "", userEmail: "", clubId: params.clubId });
			router.refresh();
		}
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-full">
				<div>
					<h3 className="text-lg font-semibold">{t("title")}</h3>
					<span className="text-muted-foreground">{t("description")}</span>
				</div>
				<FormField
					control={form.control}
					name="userName"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>{t("user")}</FormLabel>
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
												: t("searchPlaceholder")}
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</FormControl>
								</PopoverTrigger>
								<PopoverContent className="sm:w-[448px] p-0">
									<Command shouldFilter={false}>
										<CommandInput
											placeholder={t("searchPlaceholder")}
											value={searchQuery}
											onValueChange={handleSearch}
										/>
										<CommandList>
											{isLoading ? (
												<CommandEmpty className="flex items-center justify-center size-full p-4">
													<Loader className="animate-spin h-4 w-4" />
												</CommandEmpty>
											) : searchQuery.length < 2 ? (
												<CommandEmpty>{t("minimumChars")}</CommandEmpty>
											) : users.length === 0 ? (
												<CommandEmpty>{t("noResults")}</CommandEmpty>
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
																form.setValue("userEmail", user.email, {
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
							<FormDescription>{t("chooseUserDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<div className="flex gap-1 items-center -mb-2">
					<hr className="flex-1 border-t-2 border-gray-300" />
					<span className="text-gray-500">ili</span>
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
							<FormDescription>{t("emailDescription")}</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
					{t("send")}
				</Button>
			</form>
		</Form>
	);
}
