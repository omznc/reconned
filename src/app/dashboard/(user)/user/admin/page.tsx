"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { Form } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { impersonateSchema } from "./_components/impersonate.schema";
import type { z } from "zod";
import { authClient } from "@/lib/auth-client";

type User = {
	id: string;
	name: string;
	email: string;
	callsign?: string | null;
};

export default function AdminPage() {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState("");
	const [search, setSearch] = useState("");
	const [debouncedSearch] = useDebounce(search, 300);
	const [users, setUsers] = useState<User[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	const form = useForm<z.infer<typeof impersonateSchema>>({
		resolver: zodResolver(impersonateSchema),
		defaultValues: {
			userId: "",
		},
	});

	const searchUsers = async (query: string) => {
		if (!query) {
			setUsers([]);
			return;
		}

		const res = await fetch(`/api/admin/users?query=${query}`);
		const data = await res.json();
		setUsers(data);
	};

	// Search for users when debounced search value changes
	useEffect(() => {
		searchUsers(debouncedSearch);
	}, [debouncedSearch]);

	const onSubmit = async (data: z.infer<typeof impersonateSchema>) => {
		setIsLoading(true);
		await authClient.admin.impersonateUser({
			userId: data.userId,
		});
		window.location.href = "/dashboard";
		setIsLoading(false);
	};

	return (
		<div className="container py-8">
			<div className="flex flex-col">
				<Card>
					<CardHeader>
						<CardTitle>Impersoniranje korisnika</CardTitle>
						<CardDescription>
							Pretraži i impersoniraj drugog korisnika
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								className="space-y-4"
							>
								<Popover open={open} onOpenChange={setOpen}>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											role="combobox"
											aria-expanded={open}
											className="w-full justify-between"
										>
											{value
												? users.find((user) => user.id === value)?.name
												: "Odaberi korisnika..."}
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-[--radix-popover-trigger-width] p-0">
										<Command shouldFilter={false}>
											<CommandInput
												placeholder="Pretraži korisnike..."
												value={search}
												onValueChange={setSearch}
											/>
											<CommandEmpty>Nema pronađenih korisnika</CommandEmpty>
											<CommandGroup>
												{users.map((user) => (
													<CommandItem
														key={user.id}
														value={user.id}
														onSelect={(currentValue) => {
															setValue(
																currentValue === value ? "" : currentValue,
															);
															// Set the form value when user is selected
															form.setValue("userId", currentValue);
															setOpen(false);
														}}
														className="flex items-center gap-2 p-2"
													>
														<Avatar className="h-8 w-8">
															<AvatarFallback>
																{user.name.charAt(0).toUpperCase()}
															</AvatarFallback>
														</Avatar>
														<div className="flex flex-col">
															<span className="font-medium">
																{user.name}
																{user.callsign && (
																	<span className="text-muted-foreground">
																		{" "}
																		({user.callsign})
																	</span>
																)}
															</span>
															<span className="text-sm text-muted-foreground">
																{user.email}
															</span>
														</div>
													</CommandItem>
												))}
											</CommandGroup>
										</Command>
									</PopoverContent>
								</Popover>

								<LoaderSubmitButton isLoading={isLoading} className="w-full">
									Impersoniraj odabranog korisnika
								</LoaderSubmitButton>
							</form>
						</Form>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
