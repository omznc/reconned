"use client";

import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

export type DashboardClubs = ApiResponse<"/api/dashboard/clubs", "get">["clubs"];

type ClubsContextType = {
	clubs: DashboardClubs;
	refreshClubs: () => Promise<void>;
	isLoading: boolean;
};

const ClubsContext = createContext<ClubsContextType | undefined>(undefined);

interface ClubsProviderProps {
	children: ReactNode;
	initialClubs: DashboardClubs;
}

export function ClubsProvider({ children, initialClubs }: ClubsProviderProps) {
	const [clubs, setClubs] = useState<DashboardClubs>(initialClubs);
	const [isLoading, setIsLoading] = useState(false);

	const refreshClubs = useCallback(async () => {
		setIsLoading(true);
		try {
			const { data, error } = await apiClient.GET("/api/dashboard/clubs");
			if (!error && data) {
				setClubs(data.clubs);
			}
		} catch {
			// Silently fail - keep existing clubs data
		} finally {
			setIsLoading(false);
		}
	}, []);

	const value = {
		clubs,
		refreshClubs,
		isLoading,
	};

	return <ClubsContext.Provider value={value}>{children}</ClubsContext.Provider>;
}

export function useClubs() {
	const context = useContext(ClubsContext);
	if (!context) {
		throw new Error("useClubs must be used within a ClubsProvider");
	}
	return context;
}
