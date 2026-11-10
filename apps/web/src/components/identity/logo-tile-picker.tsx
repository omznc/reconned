"use client";

import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { ClubAvatar } from "@/components/identity/club-avatar";
import type { LogoTile } from "@/lib/identity";
import { cn } from "@/lib/utils";

interface LogoTilePickerProps {
	name: string;
	/** The pending file, or the already-uploaded logo. */
	file?: File | null;
	url?: string | null;
	value: LogoTile;
	onChange: (tile: LogoTile) => void;
	/** True when `value` came out of the analysis rather than from the club. */
	suggested?: boolean;
}

const TILES: LogoTile[] = ["paper", "ink"];

/**
 * The tile behind an uploaded logo, shown as the thing it actually decides:
 * two marks side by side, pick the one that reads. The analysis has already
 * chosen one — this exists for the cases it gets wrong, which is why it is a
 * pair of previews rather than a labelled setting.
 */
export function LogoTilePicker({ name, file, url, value, onChange, suggested }: LogoTilePickerProps) {
	const t = useExtracted();
	const [objectUrl, setObjectUrl] = useState<string | null>(null);

	useEffect(() => {
		if (!file) {
			setObjectUrl(null);
			return;
		}

		const created = URL.createObjectURL(file);
		setObjectUrl(created);

		return () => URL.revokeObjectURL(created);
	}, [file]);

	const src = objectUrl ?? url ?? null;
	if (!src) {
		return null;
	}

	return (
		<div className="space-y-2">
			<div className="flex gap-3">
				{TILES.map((tile) => (
					<button
						key={tile}
						type="button"
						onClick={() => onChange(tile)}
						aria-pressed={value === tile}
						className={cn(
							"rounded-lg p-1.5 transition-colors",
							"ring-2 ring-offset-2 ring-offset-background",
							value === tile ? "ring-red-500" : "ring-transparent hover:ring-border",
						)}
					>
						<ClubAvatar name={name} logo={src} tile={tile} size={64} />
						<span className="sr-only">{tile === "ink" ? t("Dark tile") : t("Light tile")}</span>
					</button>
				))}
			</div>
			<p className="text-xs text-muted-foreground">
				{suggested
					? t("Tile picked from your logo's own colours. Choose the other one if it reads better.")
					: t("The tile your logo sits on. Pick whichever keeps it legible.")}
			</p>
		</div>
	);
}
