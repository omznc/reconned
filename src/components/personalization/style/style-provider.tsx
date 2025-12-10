"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { setStyleAction } from "@/lib/global-actions/style";

type StyleType = "sharp" | "relaxed";

type StyleContextType = {
	style: StyleType;
	setStyle: (style: StyleType) => void;
};

const StyleContext = createContext<StyleContextType | undefined>(undefined);

export function StyleProvider({ children, initial }: { children: ReactNode; initial: StyleType }) {
	const [style, setStyleState] = useState<StyleType>(initial);

	useEffect(() => {
		applyStyle(style);
	}, [style]);

	const setStyle = (newStyle: StyleType) => {
		setStyleState(newStyle);
		setStyleAction({ style: newStyle });
		applyStyle(newStyle);
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
