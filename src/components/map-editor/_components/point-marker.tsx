"use client";

import type { LucideIcon } from "lucide-react";
import * as LucideIcons from "lucide-react";

const toPascalCase = (name: string) => {
	return name
		.split("-")
		.map((part) => {
			if (!part.length) {
				return "";
			}
			const first = part[0]?.toUpperCase() ?? "";
			return `${first}${part.slice(1)}`;
		})
		.join("");
};

export const getIconComponent = (name: string): LucideIcon => {
	const componentName = toPascalCase(name);
	const record = LucideIcons as unknown as Record<string, LucideIcon | undefined>;
	return record[componentName] ?? LucideIcons.MapPin;
};

type PointMarkerProps = {
	name: string;
	color?: string;
	fill?: string;
	background?: boolean;
	scale?: number;
	size?: number;
};

export function PointMarker({ name, color, fill, background = true, scale = 1, size = 22 }: PointMarkerProps) {
	const Icon = getIconComponent(name);
	const iconColor = color ?? "#111111";
	const bgColor = background ? (fill ?? "#ffffff") : "transparent";
	const base = size / 22;
	return (
		<div
			className={`flex items-center justify-center rounded-full ${background ? "shadow-sm" : ""}`}
			style={{
				backgroundColor: bgColor,
				transform: `scale(${scale * base})`,
				width: `${size}px`,
				height: `${size}px`,
				transformOrigin: "center center",
			}}
		>
			<Icon className="h-5 w-5" color={iconColor} strokeWidth={2.25} />
		</div>
	);
}
