import { lazyClientOnly } from "@/components/client-only";
import type { MapClub } from "@/components/clubs-map/clubs-map";
import { LoadingPage } from "../loading-page";

const ClubsMap = lazyClientOnly(() => import("@/components/clubs-map/clubs-map"), <LoadingPage />);

interface ClubsMapWrapperProps {
	clubs: MapClub[];
	onLocationSelect?: (lat: number, lng: number) => void;
	interactive?: boolean;
	controlsBelowHeader?: boolean;
}

export function ClubsMapWrapper(props: ClubsMapWrapperProps) {
	return <ClubsMap {...props} />;
}
