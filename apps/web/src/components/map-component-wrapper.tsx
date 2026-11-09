import { lazyClientOnly } from "@/components/client-only";

export const MapComponent = lazyClientOnly(() => import("@/components/map-component"));
