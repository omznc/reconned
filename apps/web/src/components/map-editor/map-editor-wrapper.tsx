import { lazyClientOnly } from "@/components/client-only";

export const MapEditor = lazyClientOnly(() => import("@/components/map-editor/map-editor"));
