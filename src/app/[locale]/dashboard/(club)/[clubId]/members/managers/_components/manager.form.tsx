"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import debounce from "lodash/debounce";
import { Check, ChevronsUpDown, Loader } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type * as z from "zod";
import { promoteToManager } from "@/app/[locale]/dashboard/(club)/[clubId]/members/managers/_components/manager.action";
import { promoteToManagerSchema } from "@/app/[locale]/dashboard/(club)/[clubId]/members/managers/_components/manager.schema";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Member = {
	id: string;
	user: {
		id: string;
		name: string;
		email: string;
		callsign: string | null;
	};
};

async function searchMembers(clubId: string, query: string) {
	const response = await fetch(`/api/club/${clubId}/members?query=${encodeURIComponent(query)}&role=USER`);
	if (!response.ok) {
		throw new Error("Neuspjela pretraga članova");
	}
	return response.json();
}

export function AddManagerForm() {
	const params = useParams<{ clubId: string }>();
	const [members, setMembers] = useState<Member[]>([]);
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const t = useTranslations();

	const form = useForm<z.infer<typeof promoteToManagerSchema>>({
		resolver: zodResolver(promoteToManagerSchema),
		defaultValues: {
			clubId: params.clubId,
			memberId: "",
		},
	});

	const debouncedSearch = useCallback(
		debounce(async (value: string) => {
			if (value.length >= 2) {
				setIsLoading(true);
				try {
					const results = await searchMembers(params.clubId, value);
					setMembers(results);
				} catch (_error) {
					toast.error(t("dashboard.club.members.managers.search.error"));
				} finally {
					setIsLoading(false);
				}
			} else {
				setMembers([]);
			}
		}, 400),
		[params.clubId],
	);

	const handleSearch = (value: string) => {
		setSearchQuery(value);
		debouncedSearch(value);
	};

	async function onSubmit(values: z.infer<typeof promoteToManagerSchema>) {
		try {
			const response = await promoteToManager(values);

			if (!response?.data?.success) {
				toast.error(response?.data?.error || t("dashboard.club.members.managers.promote.error"));
				return;
			}

			toast(t("dashboard.club.members.managers.promote.success"));
			form.reset({ clubId: params.clubId, memberId: "" });
		} catch (_error) {
			toast.error(t("dashboard.club.members.managers.promote.error"));
		}
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-3xl w-full">
				<div>
					<h3 className="text-lg font-semibold">{t("dashboard.club.members.managers.promote.title")}</h3>
				</div>
				<FormField
					control={form.control}
					name="memberId"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>{t("dashboard.club.members.managers.promote.member.label")}</FormLabel>
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
												? members.find((member) => member.id === field.value)?.user.name
												: t("dashboard.club.members.managers.promote.member.placeholder")}
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</FormControl>
								</PopoverTrigger>
								<PopoverContent className="sm:w-[448px] p-0">
									<Command shouldFilter={false}>
										<CommandInput
											placeholder={t("dashboard.club.members.managers.promote.member.search")}
											value={searchQuery}
											onValueChange={handleSearch}
										/>
										<CommandList>
											{isLoading ? (
												<CommandEmpty className="flex items-center justify-center size-full p-4">
													<Loader className="animate-spin h-4 w-4" />
												</CommandEmpty>
											) : searchQuery.length < 2 ? (
												<CommandEmpty>
													{t("dashboard.club.members.managers.promote.member.searchEmpty")}
												</CommandEmpty>
											) : members.length === 0 ? (
												<CommandEmpty>
													{t("dashboard.club.members.managers.promote.member.noResults")}
												</CommandEmpty>
											) : (
												<CommandGroup>
													{members.map((member) => (
														<CommandItem
															key={member.id}
															value={member.id}
															onSelect={(currentValue) => {
																form.setValue("memberId", currentValue, {
																	shouldDirty: true,
																});
																setOpen(false);
															}}
														>
															<div className="flex justify-between w-full items-center">
																<div className="flex flex-col">
																	<span>{member.user.name}</span>
																	<span className="text-sm text-muted-foreground">
																		{member.user.callsign || member.user.email}
																	</span>
																</div>
																<Check
																	className={cn(
																		"ml-auto h-4 w-4",
																		member.id === field.value
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
								{t("dashboard.club.members.managers.promote.member.description")}
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
					{t("dashboard.club.members.managers.promote.submit")}
				</Button>
			</form>
		</Form>
	);
}
