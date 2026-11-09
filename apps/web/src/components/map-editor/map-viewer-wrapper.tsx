import { lazyClientOnly } from "@/components/client-only";

export const MapViewer = lazyClientOnly(() => import("@/components/map-editor/map-viewer"));
