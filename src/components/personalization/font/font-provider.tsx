"use client";

import {
	createContext,
	useContext,
	useState,
	type ReactNode,
} from "react";

type FontType = "mono" | "sans";

type FontContextType = {
	font: FontType;
	setFont: (font: FontType) => void;
};

const FontContext = createContext<FontContextType | undefined>(undefined);

export function FontProvider({ initial, children }: { initial: "mono" | "sans", children: ReactNode; }) {
	const [font, setFont] = useState<FontType>(initial);

	return (
		<FontContext.Provider value={{ font, setFont }}>
			{children}
		</FontContext.Provider>
	);
}

export function useFont() {
	const context = useContext(FontContext);
	if (!context) {
		throw new Error("useFont must be used within a FontProvider");
	}
	return context;
}
