import type { CSSProperties } from "react";
import type { MapClub } from "@/components/clubs-map/clubs-map";
import {
	type GroupHintLabels,
	motionClass,
	motionStyle,
	PIN_FAR_SIZE,
	PIN_SELECTED_SIZE,
	PIN_SIZE,
	type PinMotion,
} from "@/components/clubs-map/grouping";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { cn } from "@/lib/utils";

// Pre-translated strings for the pins: the next-intl extractor only picks up t() calls
// made directly in the component that owns useExtracted(), not through a passed-down t.
export interface ClubIconLabels extends GroupHintLabels {
	clubLocation: string;
}

const PIN_SHADOW = "drop-shadow(0 3px 6px rgba(27,26,24,0.22)) drop-shadow(0 1px 1px rgba(27,26,24,0.14))";
const PIN_SHADOW_RAISED = "drop-shadow(0 8px 14px rgba(27,26,24,0.26)) drop-shadow(0 2px 3px rgba(27,26,24,0.16))";
export const PLATE = "#ffffff";
const PLATE_SELECTED = "#b6221f";
const PLATE_STACK = "#faf8f4";
const PLATE_STACK_BORDER = "#e4e0d8";
export const GROUP_PLATE = "#1b1a18";
const GROUP_INK = "#f4f2ee";

// Fixed geometry, drawn once. State only ever changes `transform`, so a pin can
// grow, shrink or be grabbed mid-flight without the browser re-laying anything out.
const PLATE_PAD = 3;
const PLATE_RADIUS = 12;
const TIP = 12;
/** How far the rotated tip square reaches below the plate: (TIP·√2 − TIP)/2 + TIP/3. */
const TIP_OVERHANG = Math.round((TIP * Math.SQRT2 - TIP) / 2 + TIP / 3);
const PIN_BOX_H = PIN_SIZE + TIP_OVERHANG;

const SCALE_FAR = PIN_FAR_SIZE / PIN_SIZE;
const SCALE_HOVER = 1.08;
const SCALE_SELECTED = PIN_SELECTED_SIZE / PIN_SIZE;

/**
 * A club pin's anchor is the point of its tip, not the middle of its plate, so
 * growing on select or on zoom lifts the plate off a fixed spot instead of
 * sliding the whole pin down the map.
 */
export const CLUB_MARKER = { width: PIN_SIZE, height: PIN_BOX_H, anchor: "bottom" } as const;

/** A group has no tip, so it stays centred on its centroid. */
export const GROUP_MARKER = { width: PIN_SIZE, height: PIN_SIZE, anchor: "center" } as const;

export type PinState = "default" | "hovered" | "selected";

function pinScale(state: PinState, far: boolean): number {
	if (state === "selected") {
		return SCALE_SELECTED;
	}
	if (state === "hovered") {
		return far ? SCALE_FAR * 1.18 : SCALE_HOVER;
	}
	return far ? SCALE_FAR : 1;
}

function plateBody(background: string): CSSProperties {
	return {
		position: "absolute",
		left: 0,
		top: 0,
		width: PIN_SIZE,
		height: PIN_SIZE,
		borderRadius: PLATE_RADIUS,
		background,
		boxSizing: "border-box",
	};
}

/**
 * The plate is what makes a logo legible on a busy basemap: a club's mark never
 * touches the map itself, it sits on paper. Zoomed out the inner frame closes —
 * at 28px a 3px border is just mud — and it reopens on the way back in.
 */
export function ClubPin({
	club,
	state,
	far,
	labels,
	motion,
}: {
	club: Pick<MapClub, "name" | "logo" | "logoTile">;
	state: PinState;
	far: boolean;
	labels: ClubIconLabels;
	motion?: PinMotion;
}) {
	const selected = state === "selected";
	const raised = selected || state === "hovered";
	const plate = selected ? PLATE_SELECTED : PLATE;
	const pad = far && !selected ? 0 : PLATE_PAD;

	return (
		<div
			className={motionClass(motion)}
			style={{ position: "relative", width: "100%", height: "100%", ...motionStyle(motion, false) }}
		>
			<div
				className={cn("map-pin", selected && "map-pin-settling")}
				style={{
					position: "absolute",
					left: 0,
					bottom: TIP_OVERHANG,
					width: PIN_SIZE,
					height: PIN_SIZE,
					// The origin is the tip's point, so every scale grows out of the
					// exact coordinate the pin marks.
					transformOrigin: `50% ${PIN_SIZE + TIP_OVERHANG}px`,
					transform: `scale(${pinScale(state, far)})`,
					filter: raised ? PIN_SHADOW_RAISED : PIN_SHADOW,
				}}
			>
				{/* A rotated square rather than a triangle, so the tip keeps the plate's corner radius. */}
				<div
					className="map-pin-plate"
					style={{
						position: "absolute",
						left: "50%",
						bottom: -Math.round(TIP / 3),
						marginLeft: -TIP / 2,
						width: TIP,
						height: TIP,
						background: plate,
						borderRadius: 2,
						transform: "rotate(45deg)",
					}}
				/>
				<div
					className="map-pin-plate"
					style={{ ...plateBody(plate), position: "relative", padding: pad }}
					title={club.name || labels.clubLocation}
				>
					<ClubAvatar
						name={club.name}
						logo={club.logo}
						tile={club.logoTile}
						size={PIN_SIZE - PLATE_PAD * 2}
						fill
					/>
				</div>
			</div>
			{state === "hovered" && club.name && (
				<div
					className="map-pin-label"
					style={{
						position: "absolute",
						top: "100%",
						marginTop: 6,
						left: "50%",
						padding: "4px 8px",
						borderRadius: 6,
						background: GROUP_PLATE,
						color: GROUP_INK,
						fontSize: 12,
						lineHeight: 1.2,
						whiteSpace: "nowrap",
						zIndex: 50,
					}}
				>
					{club.name}
				</div>
			)}
		</div>
	);
}

/**
 * Stacked plates say "more than one" before the number is even read — the count
 * confirms it rather than carrying the whole message on its own.
 */
export function GroupPin({
	count,
	far,
	hovered,
	hint,
	motion,
}: {
	count: number;
	far: boolean;
	hovered: boolean;
	hint: string;
	motion?: PinMotion;
}) {
	const stack: CSSProperties = {
		...plateBody(PLATE_STACK),
		border: `1px solid ${PLATE_STACK_BORDER}`,
	};

	return (
		<div
			className={motionClass(motion)}
			style={{ position: "relative", width: "100%", height: "100%", ...motionStyle(motion, true) }}
		>
			<div
				className="map-pin"
				style={{
					position: "absolute",
					inset: 0,
					transformOrigin: "50% 50%",
					transform: `scale(${pinScale(hovered ? "hovered" : "default", far)})`,
					filter: hovered ? PIN_SHADOW_RAISED : PIN_SHADOW,
				}}
				title={hint}
			>
				<div style={{ ...stack, left: PIN_SIZE * 0.114, top: PIN_SIZE * -0.114, opacity: 0.55 }} />
				<div style={{ ...stack, left: PIN_SIZE * 0.057, top: PIN_SIZE * -0.057, opacity: 0.8 }} />
				<div
					style={{
						...plateBody(GROUP_PLATE),
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: GROUP_INK,
						fontFamily: "var(--font-club-mark)",
						fontWeight: 700,
						fontSize: Math.round(PIN_SIZE * 0.4),
						lineHeight: 1,
						userSelect: "none",
					}}
				>
					{count}
				</div>
			</div>
		</div>
	);
}
