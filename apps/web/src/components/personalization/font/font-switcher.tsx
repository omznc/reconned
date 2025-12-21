"use client";

import { Type } from "lucide-react";
import { useExtracted } from "next-intl";
import posthog from "posthog-js";
import { useEffect } from "react";
import { useFont } from "@/components/personalization/font/font-provider";
import { Button } from "@/components/ui/button";
import apiClient from "@/lib/api/api.client";
import { useIsAuthenticated } from "@/lib/auth-client";

export function FontSwitcher() {
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
			onClick={() => setFont(font === "sans" ? "mono" : "sans")}
			suppressHydrationWarning
			className="w-full items-center justify-start cursor-pointer shadow-none"
		>
			<Type className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
			{t("Change font")}
		</Button>
	);
}
