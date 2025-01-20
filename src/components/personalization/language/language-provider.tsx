"use client";

import {
	createContext,
	useContext,
	useState,
	type ReactNode,
} from "react";

type LanguageContextType = {
	language: string;
	setLanguage: (language: string) => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(
	undefined,
);

export function LanguageProvider({
	initial,
	children,
}: { initial: string; children: ReactNode; }) {
	const [language, setLanguage] = useState<string>(initial);

	return (
		<LanguageContext.Provider value={{ language, setLanguage }}>
			{children}
		</LanguageContext.Provider>
	);
}

export function useLanguage() {
	const context = useContext(LanguageContext);
	if (!context) {
		throw new Error("useLanguage must be used within a LanguageProvider");
	}
	return context;
}
