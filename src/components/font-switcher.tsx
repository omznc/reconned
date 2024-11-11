"use client";

import {
	createContext,
	useContext,
	useState,
	useEffect,
	type ReactNode,
} from "react";

type FontType = "mono" | "sans";

type FontContextType = {
	font: FontType;
	setFont: (font: FontType) => void;
};

const FontContext = createContext<FontContextType | undefined>(undefined);

const getStoredFont = (): FontType => {
	if (typeof window === "undefined") {
		return "sans";
	}
	const stored = localStorage.getItem("preferred-font");
	if (stored === "mono" || stored === "sans") {
		return stored;
	}
	return "sans";
};

export function FontProvider({ children }: { children: ReactNode }) {
	const [font, setFont] = useState<FontType>(() => getStoredFont());

	useEffect(() => {
		localStorage.setItem("preferred-font", font);
	}, [font]);

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

export function FontSwitcher() {
	const { font, setFont } = useFont();

	return (
		<button
			type="button"
			onClick={() => {
				setFont(font === "mono" ? "sans" : "mono");
			}}
			className="fixed bottom-4 right-4 p-2 bg-background border rounded-md"
		>
			{font === "mono" ? "Switch to Sans" : "Switch to Mono"}
		</button>
	);
}
