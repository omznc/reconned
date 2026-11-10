"use client";

import { Type } from "lucide-react";
import { useExtracted } from "next-intl";
import posthog from "posthog-js";
import { useEffect } from "react";
import { useFont } from "@/components/personalization/font/font-provider";
import { Button, type ButtonProps } from "@/components/ui/button";
import apiClient from "@/lib/api/api.client";
import { useIsAuthenticated } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/** Forwards the props of `DropdownMenuItem asChild`: the item padding, role and keyboard handlers. */
export function FontSwitcher({ className, onClick, ...props }: ButtonProps) {
	const { font, setFont } = useFont();
	const t = useExtracted();
	const { user } = useIsAuthenticated();

	useEffect(() => {
		if (font !== "sans" && font !== "mono") {
			return;
		}

		if (!user?.id) {
			return;
		}

		if (user.font === font) {
			return;
		}

		apiClient.PUT("/api/users/{id}/font", {
			params: {
				path: {
					id: user.id,
				},
			},
			body: {
				font: font,
			},
		});

		posthog.capture("preference_changed", {
			user_id: user.id,
			preference_type: "font",
			old_value: user.font,
			new_value: font,
		});
	}, [font, user]);

	return (
		<Button
			variant="ghost"
			{...props}
			onClick={(event) => {
				onClick?.(event);
				setFont(font === "sans" ? "mono" : "sans");
			}}
			suppressHydrationWarning
			className={cn("w-full items-center justify-start cursor-pointer shadow-none", className)}
		>
			<Type className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
			{t("Change font")}
		</Button>
	);
}
