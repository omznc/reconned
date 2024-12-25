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
import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createPurchase } from "./spending.action";
import type { PurchaseFormValues } from "@/app/dashboard/(club)/[clubId]/club/spending/_components/spending.schema";
import { purchaseFormSchema } from "@/app/dashboard/(club)/[clubId]/club/spending/_components/spending.schema";

export function AddPurchaseModal() {
	const [open, setOpen] = useState(false);
	const params = useParams<{ clubId: string }>();
	const router = useRouter();
	const form = useForm<PurchaseFormValues>({
		resolver: zodResolver(purchaseFormSchema),
		defaultValues: {
			clubId: params.clubId,
			title: "",
			description: "",
			amount: 0,
		},
	});

	const onSubmit = async (data: PurchaseFormValues) => {
		try {
			const result = await createPurchase(data);
			if (result?.data) {
				toast.success("Kupovina uspješno dodana");
				setOpen(false);
				form.reset();
				router.refresh();
			}
		} catch (error) {
			toast.error("Greška prilikom dodavanja kupovine");
		}
	};

	return (
		<Credenza open={open} onOpenChange={setOpen}>
			<CredenzaTrigger asChild>
				<Button>
					<Plus className="mr-2 h-4 w-4" />
					Nova kupovina
				</Button>
			</CredenzaTrigger>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>Nova kupovina</CredenzaTitle>
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
											<Input placeholder="Naziv kupovine" {...field} />
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
											<Textarea placeholder="Opis kupovine" {...field} />
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
												placeholder="0.00"
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
								Dodaj kupovinu
							</Button>
						</form>
					</Form>
				</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}
