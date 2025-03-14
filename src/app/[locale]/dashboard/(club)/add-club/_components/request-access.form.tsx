"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { requestAccess } from "./request-access.action";
import { useTranslations } from "next-intl";
import {
	requestAccessSchema,
	type RequestAccessSchema,
} from "@/app/[locale]/dashboard/(club)/add-club/_components/request-access.schema";
import { useCallback, useState } from "react";
import debounce from "lodash/debounce";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader } from "lucide-react";
import { cn } from "@/lib/utils";

type Club = {
	id: string;
	name: string;
};

async function searchClubs(query: string) {
	const response = await fetch(`/api/clubs?query=${encodeURIComponent(query)}`);
	if (!response.ok) {
		throw new Error("Failed to fetch clubs");
	}
	return response.json() as Promise<Club[]>;
}

export function RequestAccessForm() {
	const t = useTranslations("dashboard.addClub");
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
					toast.error(t("searchFailed"));
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
			toast.success(t("requestSent"));
			form.reset();
		} else {
			toast.error(response?.data?.error || t("requestFailed"));
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
							<FormLabel>{t("selectClub")}</FormLabel>
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
												: t("selectClubPlaceholder")}
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</FormControl>
								</PopoverTrigger>
								<PopoverContent className="w-full p-0">
									<Command shouldFilter={false}>
										<CommandInput
											placeholder={t("searchClubs")}
											value={searchQuery}
											onValueChange={handleSearch}
										/>
										<CommandList>
											{isLoading ? (
												<CommandEmpty className="flex items-center justify-center p-4">
													<Loader className="animate-spin h-4 w-4" />
												</CommandEmpty>
											) : searchQuery.length < 2 ? (
												<CommandEmpty>{t("enterTwoChars")}</CommandEmpty>
											) : clubs.length === 0 ? (
												<CommandEmpty>{t("noClubsFound")}</CommandEmpty>
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
				<Button type="submit">{t("sendRequest")}</Button>
			</form>
		</Form>
	);
}
