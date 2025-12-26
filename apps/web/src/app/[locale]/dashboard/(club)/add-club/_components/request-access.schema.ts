import { useExtracted } from "next-intl";
import * as z from "zod";

export function useRequestAccessSchema() {
	const t = useExtracted();

	return z.object({
		clubIdTarget: z.string().min(1, t("Club is required")),
		message: z.string().optional(),
	});
}

export type RequestAccessSchema = z.infer<ReturnType<typeof useRequestAccessSchema>>;
