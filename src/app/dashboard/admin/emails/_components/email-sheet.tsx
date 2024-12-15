"use client";

import type { ReactNode } from "react";
import {
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	Sheet,
} from "@/components/ui/sheet";
import { useQueryState } from "nuqs";

interface EmailListProps {
	renderedContent: string;
}

export function EmailList({ renderedContent }: EmailListProps) {
	const [email, setEmail] = useQueryState("email", {
		defaultValue: "",
		clearOnDefault: true,
		shallow: false,
	});

	return (
		<Sheet open={email !== ""} onOpenChange={() => setEmail("")}>
			<SheetContent
				side="right"
				className="w-screen sm:w-[45vw] overflow-y-auto flex flex-col"
			>
				<SheetHeader>
					<SheetTitle>Prikaz email-a</SheetTitle>
					<SheetDescription className="hidden dark:block">
						E-mail se samo prikazuje u svijetloj temi zbog kompatibilnosti.
					</SheetDescription>
				</SheetHeader>
				<iframe
					srcDoc={renderedContent}
					className="w-full h-full"
					title={"Email Preview"}
				/>
			</SheetContent>
		</Sheet>
	);
}
