"use client";

import posthog from "posthog-js";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import apiClient from "@/lib/api/api.client";
import { useIsAuthenticated } from "@/lib/auth-client";

type StyleType = "sharp" | "relaxed";

type StyleContextType = {
	style: StyleType;
	setStyle: (style: StyleType) => void;
};

const StyleContext = createContext<StyleContextType | undefined>(undefined);

export function StyleProvider({ children, initial }: { children: ReactNode; initial: StyleType }) {
	const [style, setStyleState] = useState<StyleType>(initial);
	const { user } = useIsAuthenticated();

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const stored = window.localStorage.getItem("reconned-style");
		if (stored === "sharp" || stored === "relaxed") {
			if (stored !== style) {
				setStyleState(stored);
				applyStyle(stored);
				return;
			}
		}

		applyStyle(style);
	}, []);

	useEffect(() => {
		applyStyle(style);
	}, [style]);

	const setStyle = (newStyle: StyleType) => {
		setStyleState(newStyle);
		applyStyle(newStyle);

		if (typeof window !== "undefined") {
			window.localStorage.setItem("reconned-style", newStyle);
		}

		if (!user?.id) {
			return;
		}

		if (user.style === newStyle) {
			return;
		}

		apiClient.PUT("/api/users/{id}/style", {
			params: {
				path: {
					id: user.id,
				},
			},
			body: {
				style: newStyle,
			},
		});

		posthog.capture("preference_changed", {
			user_id: user.id,
			preference_type: "style",
			old_value: user.style,
			new_value: newStyle,
		});
	};

	return <StyleContext.Provider value={{ style, setStyle }}>{children}</StyleContext.Provider>;
}

function applyStyle(style: StyleType) {
	const root = document.documentElement;
	if (style === "sharp") {
		root.style.setProperty("--radius", "0rem");
	} else {
		root.style.setProperty("--radius", "1rem");
	}
}

export function useStyle() {
	const context = useContext(StyleContext);
	if (!context) {
		throw new Error("useStyle must be used within a StyleProvider");
	}
	return context;
}
