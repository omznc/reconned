import { setupPasswordAction } from "@/app/dashboard/(user)/user/security/_components/password.action";
import { setupPasswordSchema } from "@/app/dashboard/(user)/user/security/_components/password.schema";
import { Button } from "@components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@components/ui/form";
import { Input } from "@components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

export function SetupPasswordForm({
	isLoading,
	setIsLoading,
}: { isLoading: boolean; setIsLoading: Dispatch<SetStateAction<boolean>>; }) {
	const router = useRouter();

	const setupPasswordForm = useForm<z.infer<typeof setupPasswordSchema>>({
		resolver: zodResolver(setupPasswordSchema),
		defaultValues: {
			password: "",
		},
	});

	const onSetupPasswordSubmit = async (
		values: z.infer<typeof setupPasswordSchema>,
	) => {
		setIsLoading(true);
		try {
			const response = await setupPasswordAction({
				password: values.password,
			});

			if (response?.data?.success) {
				toast.success("Lozinka uspješno postavljena.");
				router.refresh();
			} else {
				toast.error("Došlo je do greške prilikom postavljanja lozinke.");
			}
			setIsLoading(false);
		} catch (_e) {
			toast(
				"Došlo je do greške prilikom postavljanja lozinke. Molimo pokušajte ponovo.",
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Form {...setupPasswordForm}>
			<form
				onSubmit={setupPasswordForm.handleSubmit(onSetupPasswordSubmit)}
				className="space-y-4 w-full"
			>
				<div>
					<h3 className="text-lg font-semibold">Postavi lozinku</h3>
				</div>
				<FormField
					control={setupPasswordForm.control}
					name="password"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Nova lozinka</FormLabel>
							<FormControl>
								<Input type="password" disabled={isLoading} {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit" className="w-full" disabled={isLoading}>
					<LockIcon className="w-4 h-4 mr-2" />
					{isLoading ? "Postavljanje lozinke..." : "Postavi lozinku"}
				</Button>
			</form>
		</Form>
	);
}
