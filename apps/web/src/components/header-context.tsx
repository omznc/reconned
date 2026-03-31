"use client";

import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

type HeaderVisibilityContextType = {
	isVisible: boolean;
	showHeader: () => void;
	hideHeader: () => void;
	toggleHeader: (visible: boolean) => void;
};

const HeaderVisibilityContext = createContext<HeaderVisibilityContextType | null>(null);

export function HeaderProvider({ children }: { children: ReactNode }) {
	const [isVisible, setIsVisible] = useState(true);

	const showHeader = useCallback(() => setIsVisible(true), []);
	const hideHeader = useCallback(() => setIsVisible(false), []);
	const toggleHeader = useCallback((visible: boolean) => setIsVisible(visible), []);

	return (
		<HeaderVisibilityContext.Provider value={{ isVisible, showHeader, hideHeader, toggleHeader }}>
			{children}
		</HeaderVisibilityContext.Provider>
	);
}

export function useHeaderVisibility() {
	const context = useContext(HeaderVisibilityContext);
	if (!context) {
		throw new Error("useHeaderVisibility must be used within a HeaderProvider");
	}
	return context;
}
