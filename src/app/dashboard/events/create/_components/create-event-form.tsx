"use client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type * as z from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { createEventFormSchema } from "@/app/dashboard/events/create/_components/create-event-form.schema";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import {
	DateTimePicker,
	initHourFormat,
} from "@/components/ui/date-time-picker";
import { bs, hr } from "date-fns/locale";

export default function CreateEventForm() {
	const form = useForm<z.infer<typeof createEventFormSchema>>({
		resolver: zodResolver(createEventFormSchema),
	});

	function onSubmit(values: z.infer<typeof createEventFormSchema>) {
		try {
			console.log(values);
			toast(
				<pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
					<code className="text-white">{JSON.stringify(values, null, 2)}</code>
				</pre>,
			);
		} catch (error) {
			console.error("Form submission error", error);
			toast.error("Failed to submit the form. Please try again.");
		}
	}

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="space-y-4 max-w-3xl"
			>
				<div>
					<h3 className="text-lg font-semibold">Općenito</h3>
				</div>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Ime*</FormLabel>
							<FormControl>
								<Input placeholder="Food Wars 24" type="text" {...field} />
							</FormControl>
							<FormDescription>Ovo je naziv vašeg susreta.</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="description"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Opis*</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Ponesite pribor za jelo..."
									className="resize-none"
									{...field}
								/>
							</FormControl>
							<FormDescription>
								Opis susreta. Ovo može biti priča, briefing, ili bilo šta što ne
								spada u druge kategorije.
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="costPerPerson"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Kotizacija/cijena</FormLabel>
							<FormControl>
								<Input placeholder="20" type="number" {...field} />
							</FormControl>
							<FormDescription>
								Koliko susret košta po igraču, u KM?
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="location"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Lokacija*</FormLabel>
									<FormControl>
										<Input placeholder="Livno" type="text" {...field} />
									</FormControl>
									<FormDescription>Gdje se ordžava susret?</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="googleMapsLink"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Google Maps</FormLabel>
									<FormControl>
										<Input placeholder="" type="text" {...field} />
									</FormControl>
									<FormDescription>
										Možete dodati Google Maps link za upute.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div>
					<h3 className="text-lg font-semibold">Vrijeme</h3>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="dateStart"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Početak*</FormLabel>
									<Popover>
										<PopoverTrigger asChild>
											<FormControl>
												<Button
													variant={"outline"}
													className={cn(
														"w-full pl-3 text-left font-normal",
														!field.value && "text-muted-foreground",
													)}
												>
													{field.value ? (
														format(field.value, initHourFormat.hour24, {
															locale: bs,
														})
													) : (
														<span>Odaberite datum</span>
													)}
													<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<DateTimePicker
												value={field.value}
												onChange={field.onChange}
											/>
										</PopoverContent>
									</Popover>
									<FormDescription>Kada susret počinje?</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="dateEnd"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Kraj*</FormLabel>
									<Popover>
										<PopoverTrigger asChild>
											<FormControl>
												<Button
													variant={"outline"}
													className={cn(
														"w-full pl-3 text-left font-normal",
														!field.value && "text-muted-foreground",
													)}
												>
													{field.value ? (
														format(field.value, initHourFormat.hour24, {
															locale: bs,
														})
													) : (
														<span>Odaberite datum</span>
													)}
													<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<DateTimePicker
												value={field.value}
												onChange={field.onChange}
											/>
										</PopoverContent>
									</Popover>
									<FormDescription>Kada susret završava?</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="dateRegistrationsOpen"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Početak registracije</FormLabel>
									<Popover>
										<PopoverTrigger asChild>
											<FormControl>
												<Button
													variant={"outline"}
													className={cn(
														"w-full pl-3 text-left font-normal",
														!field.value && "text-muted-foreground",
													)}
												>
													{field.value ? (
														format(field.value, initHourFormat.hour24, {
															locale: bs,
														})
													) : (
														<span>Odaberite datum</span>
													)}
													<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<DateTimePicker
												value={field.value}
												onChange={field.onChange}
											/>
										</PopoverContent>
									</Popover>
									<FormDescription>
										Kada se igrači mogu registrirati? Ostavite prazno da
										dozvolite registraciju odmah.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="dateRegistrationsClose"
							render={({ field }) => (
								<FormItem className="flex flex-col">
									<FormLabel>Kraj registracije*</FormLabel>
									<Popover>
										<PopoverTrigger asChild>
											<FormControl>
												<Button
													variant={"outline"}
													className={cn(
														"w-full pl-3 text-left font-normal",
														!field.value && "text-muted-foreground",
													)}
												>
													{field.value ? (
														format(field.value, initHourFormat.hour24, {
															locale: bs,
														})
													) : (
														<span>Odaberite datum</span>
													)}
													<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0" align="start">
											<DateTimePicker
												value={field.value}
												onChange={field.onChange}
											/>
										</PopoverContent>
									</Popover>
									<FormDescription>
										Kada završavaju registracije?
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div>
					<h3 className="text-lg font-semibold">Vidljivost</h3>
				</div>

				<FormField
					control={form.control}
					name="isPrivate"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<FormLabel>Privatni susret*</FormLabel>
								<FormDescription>
									Susret će biti vidljiv samo vašem klubu. Korisno ako planirate
									trening.
								</FormDescription>
							</div>
							<FormControl>
								<Switch
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
							</FormControl>
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="allowFreelancers"
					render={({ field }) => (
						<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<FormLabel>Freelancer prijave*</FormLabel>
								<FormDescription>
									Na susret se mogu prijaviti ljudi koji nisu aktivno u nekom
									klubu.
								</FormDescription>
							</div>
							<FormControl>
								<Switch
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
							</FormControl>
						</FormItem>
					)}
				/>

				<div>
					<h3 className="text-lg font-semibold">Organizacija</h3>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasBreakfast"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Doručak</FormLabel>
										<FormDescription>
											Da li će susret imati doručak?
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasLunch"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Ručak</FormLabel>
										<FormDescription>
											Da li će susret imati ručak?
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasDinner"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Večera</FormLabel>
										<FormDescription>
											Da li će susret imati večeru?
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasSnacks"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Grickalice</FormLabel>
										<FormDescription>
											Da li će susret imati grickalice?
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</div>
				</div>

				<div className="grid grid-cols-6 md:grid-cols-12 gap-4">
					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasDrinks"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Pića</FormLabel>
										<FormDescription>
											Da li će susret imati pića?
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</div>

					<div className="col-span-6">
						<FormField
							control={form.control}
							name="hasPrizes"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
									<div className="space-y-0.5">
										<FormLabel>Nagrade</FormLabel>
										<FormDescription>
											Da li će biti nagrade za pobjednike?
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</div>
				</div>
				<LoaderSubmitButton isLoading={false}>Spremi</LoaderSubmitButton>
			</form>
		</Form>
	);
}
