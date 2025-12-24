"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

type FontType = "mono" | "sans";

type FontContextType = {
	font: FontType;
	setFont: (font: FontType) => void;
};

const FontContext = createContext<FontContextType | undefined>(undefined);

export function FontProvider({ initial, children }: { initial: "mono" | "sans"; children: ReactNode }) {
	const [font, setFontState] = useState<FontType>(initial);

	if (typeof window !== "undefined") {
		const stored = window.localStorage.getItem("reconned-font");
		if (stored === "mono" || stored === "sans") {
			if (stored !== font) {
				setFontState(stored);
			}
		}
	}

	const setFont = (newFont: FontType) => {
		setFontState(newFont);
		if (typeof window !== "undefined") {
			window.localStorage.setItem("reconned-font", newFont);
		}
	};

	return <FontContext.Provider value={{ font, setFont }}>{children}</FontContext.Provider>;
}

export function useFont() {
	const context = useContext(FontContext);
	if (!context) {
		throw new Error("useFont must be used within a FontProvider");
	}
	return context;
}
