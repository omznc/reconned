"use client";

import { useEffect } from "react";

export function MapScrollLock() {
	useEffect(() => {
		const html = document.documentElement;
		const body = document.body;
		const prevHtml = html.style.overflow;
		const prevBody = body.style.overflow;
		html.style.overflow = "hidden";
		body.style.overflow = "hidden";
		return () => {
			html.style.overflow = prevHtml;
			body.style.overflow = prevBody;
		};
	}, []);
	return null;
}
