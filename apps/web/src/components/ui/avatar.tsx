"use client";

import {
	Avatar as FacehashAvatar,
	AvatarFallback as FacehashAvatarFallback,
	AvatarImage as FacehashAvatarImage,
} from "facehash";
import type * as React from "react";

import { personInitials, personTint } from "@/lib/identity";
import { cn } from "@/lib/utils";

/**
 * People are circles, clubs are squares. That one difference carries the whole
 * distinction, so a player and a club never get confused in a mixed list — which
 * is why the shape is fixed here rather than left to each call site.
 *
 * For clubs, use `<ClubAvatar />` instead.
 */
function Avatar({ className, ...props }: React.ComponentProps<typeof FacehashAvatar>) {
	return (
		<FacehashAvatar
			className={cn("identity-avatar relative flex shrink-0 overflow-hidden rounded-full", className)}
			{...props}
		/>
	);
}

/**
 * Uploaded photos are cropped to a centre square, then masked — no tile behind
 * them, since a photo has no transparency to protect.
 */
function AvatarImage({ className, ...props }: React.ComponentProps<typeof FacehashAvatarImage>) {
	return <FacehashAvatarImage className={cn("aspect-square size-full object-cover", className)} {...props} />;
}

/**
 * A pale tint with ink initials — quieter than a club's dark hatched field,
 * because a person's avatar is usually next to their name rather than standing
 * alone. Initials scale off the avatar box, so call sites keep sizing with
 * plain `h-*`/`w-*` classes.
 */
function AvatarFallback({
	className,
	name,
	style,
	children,
	...props
}: React.ComponentProps<typeof FacehashAvatarFallback>) {
	const [color, ink] = personTint(name ?? "");
	// Call sites that supply their own content (an icon for a deleted author, a
	// count) keep their own colours — the hashed tint is for a real person.
	// A missing name still gets a tinted circle rather than a hole — it reads as
	// an unknown person instead of a broken avatar.
	const generated = children === undefined;

	return (
		<FacehashAvatarFallback
			facehash={false}
			name={name}
			className={cn("flex size-full items-center justify-center rounded-full", className)}
			style={generated ? { backgroundColor: color, color: ink, ...style } : style}
			{...props}
		>
			{generated ? (
				<span className="identity-initials font-person-mark font-semibold tracking-[0.01em]">
					{name ? personInitials(name) : null}
				</span>
			) : (
				children
			)}
		</FacehashAvatarFallback>
	);
}

export { Avatar, AvatarFallback, AvatarImage };
