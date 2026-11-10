import type { ComponentProps, ComponentType } from "react";
import type { Link } from "@/i18n/navigation";

/** A Lucide icon, or one of the brand icons in `@/components/icons`. */
export type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export type Href = ComponentProps<typeof Link>["href"];
