"use client";

import { authClient } from "@/lib/auth-client";
import { X } from "lucide-react";

export function ImpersonationAlert() {
	return (
		<div className="flex text-black font-semibold items-center gap-2 fixed bottom-4 right-4 p-2 bg-red-500 z-10">
			<p>Impersoniran</p>
			<X
				className="cursor-pointer"
				onClick={async () => {
					await authClient.admin.stopImpersonating();
					window.location.reload();
				}}
			/>
		</div>
	);
}
