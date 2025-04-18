"use client";

import type { Club } from "@prisma/client";
import { type ReactNode, createContext, useContext, useState } from "react";

type CurrentClubContextType = {
	clubId?: Club["id"];
	setClubId?: (id: Club["id"]) => void;
};

const CurrentClubContextBase = createContext<CurrentClubContextType | undefined>(undefined);

export const CurrentClubProvider = ({
	children,
	clubId: initialClubId,
}: { children: ReactNode } & { clubId?: Club["id"] }) => {
	const [clubId, setClubId] = useState<Club["id"] | undefined>(initialClubId);

	return <CurrentClubContextBase.Provider value={{ clubId, setClubId }}>{children}</CurrentClubContextBase.Provider>;
};

export const useCurrentClub = () => {
	const context = useContext(CurrentClubContextBase);
	if (!context) {
		throw new Error("useCurrentClub must be used within a CurrentClubProvider");
	}

	return context;
};
