import { applyStoredConsent } from "@/lib/consent";

// Not initialised unconditionally: `init()` only runs once a stored consent decision says yes.
// See `src/lib/consent.ts` and `src/components/consent-banner.tsx`.
applyStoredConsent();
