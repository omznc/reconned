import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * A hook to handle scrolling to an element when a hash is present in the URL
 * This fixes the browser not scrolling to hash fragments on initial load
 */
export function useHash() {
	const { pathname, searchStr } = useLocation();

	useEffect(() => {
		// Get the hash from the URL (if any)
		const hash = window.location.hash;

		if (hash) {
			// Remove the # character
			const id = hash.substring(1);

			// Find the element with the matching ID
			const element = document.getElementById(id);

			// If element exists, scroll to it with a small delay to ensure rendering is complete
			if (element) {
				setTimeout(() => {
					element.scrollIntoView({ behavior: "smooth" });
				}, 100);
			}
		}
	}, [pathname, searchStr]); // Re-run when pathname or search params change
}
