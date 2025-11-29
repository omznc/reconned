"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

type RoundnessType = "sharp" | "relaxed";

type RoundnessContextType = {
	roundness: RoundnessType;
	setRoundness: (roundness: RoundnessType) => void;
};

const RoundnessContext = createContext<RoundnessContextType | undefined>(undefined);

const STORAGE_KEY = "roundness";
const DEFAULT_ROUNDNESS: RoundnessType = "relaxed";

function getRoundnessFromStorage(): RoundnessType {
	if (typeof window === "undefined") {
		return DEFAULT_ROUNDNESS;
	}
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === "sharp" || stored === "relaxed") {
		return stored;
	}
	return DEFAULT_ROUNDNESS;
}

export function RoundnessProvider({ children }: { children: ReactNode }) {
	const [roundness, setRoundnessState] = useState<RoundnessType>(() => {
		if (typeof window !== "undefined") {
			return getRoundnessFromStorage();
		}
		return DEFAULT_ROUNDNESS;
	});

	useEffect(() => {
		applyRoundness(roundness);
	}, [roundness]);

	const setRoundness = (newRoundness: RoundnessType) => {
		setRoundnessState(newRoundness);
		localStorage.setItem(STORAGE_KEY, newRoundness);
		applyRoundness(newRoundness);
	};

	return <RoundnessContext.Provider value={{ roundness, setRoundness }}>{children}</RoundnessContext.Provider>;
}

function applyRoundness(roundness: RoundnessType) {
	const root = document.documentElement;
	if (roundness === "sharp") {
		root.style.setProperty("--radius", "0rem");
	} else {
		root.style.setProperty("--radius", "1rem");
	}
}

export function useRoundness() {
	const context = useContext(RoundnessContext);
	if (!context) {
		throw new Error("useRoundness must be used within a RoundnessProvider");
	}
	return context;
}
