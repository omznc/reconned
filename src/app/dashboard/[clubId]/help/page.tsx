"use client";

import { useHash } from "@/hooks/use-hash";
import { Hash } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

export default function Page() {
	return (
		<div className="space-y-4 max-w-3xl w-full">
			<div>
				<h3 className="text-lg font-semibold">Pomoć</h3>
			</div>
			<Question question="Kako dodati Google Maps na susret" id="google-maps">
				TODO: Explain this
			</Question>
		</div>
	);
}

function Question({
	question,
	children,
	id,
}: { question: string; children: ReactNode; id: string }) {
	const hash = useHash();
	return (
		<div className="space-y-2" id={id}>
			<div
				data-active={hash === id}
				className="text-lg data-[active=true]:underline decoration-foreground/50 group inline-flex items-center gap-1 font-semibold"
			>
				{question}

				<button
					type="button"
					className="opacity-0 group-hover:opacity-100 transition-opacity"
					onClick={() => {
						const currentNoHash = window.location.href.replace(
							window.location.hash,
							"",
						);
						window.navigator.clipboard
							.writeText(`${currentNoHash}#${id}`)
							.then(() => {
								toast.success("Link kopiran.");
							})
							.catch(() => {
								toast.error("Neuspješno kopiranje linka.");
							});
					}}
				>
					<Hash className="w-4 h-4" />
				</button>
			</div>
			{typeof children === "string" ? <p>{children}</p> : children}
		</div>
	);
}
