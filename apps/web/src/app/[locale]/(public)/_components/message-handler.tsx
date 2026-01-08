"use client";

import { useQueryState } from "nuqs";
import { useEffect } from "react";
import { toast } from "sonner";

export function MessageHandler() {
	const [message] = useQueryState("message");
	useEffect(() => {
		toast.dismiss("message");
		if (message) {
			toast.success(decodeURIComponent(message), {
				id: "message",
			});
		}
	}, [message]);
	return null;
}
