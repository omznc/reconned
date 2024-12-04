"use client";

import { authClient } from "@/lib/auth-client";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

export function ImpersonationAlert() {
	const router = useRouter();
	return (
		<div className="flex items-center gap-2 fixed bottom-4 right-4 p-1 bg-red-500 z-10">
			<p>Impersoniran</p>
			<X
				className="cursor-pointer"
				onClick={async () => {
					await authClient.signOut().then(() => router.push("/"));
				}}
			/>
		</div>
	);
}
