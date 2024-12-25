"use client";

import { Button } from "@/components/ui/button";
import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaHeader,
	CredenzaTitle,
	CredenzaTrigger,
} from "@/components/ui/credenza";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { updatePurchase } from "./spending.action";
import type { EditPurchaseFormValues } from "./spending.schema";
import { editPurchaseFormSchema } from "./spending.schema";
import type { Purchases } from "@prisma/client";

export function EditPurchaseModal({ purchase }: { purchase: Purchases }) {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const form = useForm<EditPurchaseFormValues>({
		resolver: zodResolver(editPurchaseFormSchema),
		defaultValues: {
			id: purchase.id,
			clubId: purchase.clubId,
			title: purchase.title,
			description: purchase.description || "",
			amount: purchase.amount,
		},
	});

	const onSubmit = async (data: EditPurchaseFormValues) => {
		try {
			const result = await updatePurchase(data);
			if (result?.data) {
				toast.success("Kupovina uspješno izmijenjena");
				setOpen(false);
				router.refresh();
			}
		} catch (error) {
			toast.error("Greška prilikom izmjene kupovine");
		}
	};

	return (
		<Credenza open={open} onOpenChange={setOpen}>
			<CredenzaTrigger asChild>
				<Button variant="ghost" size="icon" type="button">
					<Pencil className="h-4 w-4" />
				</Button>
			</CredenzaTrigger>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>Izmijeni kupovinu</CredenzaTitle>
				</CredenzaHeader>
				<CredenzaBody>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="title"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Naslov</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Opis</FormLabel>
										<FormControl>
											<Textarea {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="amount"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Iznos (KM)</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
												{...field}
												onChange={(e) =>
													field.onChange(Number.parseFloat(e.target.value))
												}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button type="submit" className="w-full">
								Sačuvaj izmjene
							</Button>
						</form>
					</Form>
				</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}
