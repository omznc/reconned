"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import debounce from "lodash/debounce";
import { Check, ChevronsUpDown, Loader } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
	type RequestAccessSchema,
	requestAccessSchema,
} from "@/app/[locale]/dashboard/(club)/add-club/_components/request-access.schema";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { requestAccess } from "./request-access.action.ts";

type Club = {
	id: string;
	name: string;
};

async function searchClubs(query: string) {
	const response = await fetch(`/api/clubs?query=${encodeURIComponent(query)}`);
	if (!response.ok) {
		throw new ActionError("Failed to fetch clubs");
	}
	return response.json() as Promise<Club[]>;
}

export function RequestAccessForm() {
	const t = useExtracted();
	const [clubs, setClubs] = useState<Club[]>([]);
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const form = useForm<RequestAccessSchema>({
		resolver: zodResolver(requestAccessSchema),
	});

	const debouncedSearch = useCallback(
		debounce(async (value: string) => {
			if (value.length >= 2) {
				setIsLoading(true);
				try {
					const results = await searchClubs(value);
					setClubs(results);
				} catch (_error) {
					toast.error(t("Error searching clubs"));
				} finally {
					setIsLoading(false);
				}
			} else {
				setClubs([]);
			}
		}, 400),
		[],
	);

	const handleSearch = (value: string) => {
		setSearchQuery(value);
		debouncedSearch(value);
	};

	async function onSubmit(data: RequestAccessSchema) {
		const response = await requestAccess(data);

		if (response?.data?.success) {
			toast.success(t("Request sent successfully"));
			form.reset();
		} else {
			toast.error(response?.data?.error || t("Error sending request"));
		}
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="clubIdTarget"
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel>{t("Select club")}</FormLabel>
							<Popover open={open} onOpenChange={setOpen}>
								<PopoverTrigger asChild>
									<FormControl>
										<Button
											variant="outline"
											role="combobox"
											aria-expanded={open}
											className={cn(
												"w-full justify-between",
												!field.value && "text-muted-foreground",
											)}
										>
											{field.value
												? clubs.find((club) => club.id === field.value)?.name
												: t("Select club...")}
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</FormControl>
								</PopoverTrigger>
								<PopoverContent className="w-full p-0">
									<Command shouldFilter={false}>
										<CommandInput
											placeholder={t("Search clubs...")}
											value={searchQuery}
											onValueChange={handleSearch}
										/>
										<CommandList>
											{isLoading ? (
												<CommandEmpty className="flex items-center justify-center p-4">
													<Loader className="animate-spin h-4 w-4" />
												</CommandEmpty>
											) : searchQuery.length < 2 ? (
												<CommandEmpty>{t("Enter at least two characters")}</CommandEmpty>
											) : clubs.length === 0 ? (
												<CommandEmpty>{t("No clubs found")}</CommandEmpty>
											) : (
												<CommandGroup>
													{clubs.map((club) => (
														<CommandItem
															key={club.id}
															value={club.id}
															onSelect={() => {
																form.setValue("clubIdTarget", club.id);
																setOpen(false);
															}}
														>
															{club.name}
															<Check
																className={cn(
																	"ml-auto h-4 w-4",
																	club.id === field.value
																		? "opacity-100"
																		: "opacity-0",
																)}
															/>
														</CommandItem>
													))}
												</CommandGroup>
											)}
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit">{t("Send request")}</Button>
			</form>
		</Form>
	);
}
