import { type ReactNode, useEffect } from "react";
import { useFont } from "@/components/personalization/font/font-provider";

/**
 * Applies the font preference to `<body>`, so portals (dropdowns, dialogs) inherit it too.
 * The server renders the sans class; the stored preference is applied after mount.
 */
export function FontBody({ children }: { children: ReactNode }) {
	const { font } = useFont();

	useEffect(() => {
		document.body.classList.toggle("font-geist-mono", font === "mono");
		document.body.classList.toggle("font-geist-sans", font !== "mono");
	}, [font]);

	return children;
}
