"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { ActionError } from "@/lib/action-error";
import apiClient from "@/lib/api";
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
		applyStyle(style);
	}, [style]);

	const setStyle = (newStyle: StyleType) => {
		setStyleState(newStyle);
		applyStyle(newStyle);

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
		throw new ActionError("useStyle must be used within a StyleProvider");
	}
	return context;
}
