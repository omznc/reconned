"use client";

import { useEffect, useState } from "react";

/**
 * Returns `false` during SSR and the initial client render, then `true` once the
 * component has mounted on the client.
 *
 * Use this to gate rendering of values that differ between the server and the
 * browser — relative-to-now dates (`formatDistanceToNow`) or timezone/locale
 * dependent output (`toLocaleDateString`) — which would otherwise cause React
 * hydration mismatches (minified error #418). Render a stable placeholder while
 * this is `false`, then the real value once it is `true`.
 */
export function useMounted(): boolean {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return mounted;
}
