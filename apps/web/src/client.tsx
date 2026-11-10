import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { applyStoredConsent } from "@/lib/consent";

// Not initialised unconditionally: `init()` only runs once a stored consent decision says yes.
// See `src/lib/consent.ts` and `src/components/consent-banner.tsx`.
applyStoredConsent();

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<StartClient />
		</StrictMode>,
	);
});
