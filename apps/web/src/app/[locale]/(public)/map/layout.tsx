import type { ReactNode } from "react";
import { MapScrollLock } from "./_components/map-scroll-lock";

export default function MapLayout({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<>
			<MapScrollLock />
			{children}
		</>
	);
}
