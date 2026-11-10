import { expect, test } from "bun:test";
import type { MapClub } from "@/components/clubs-map/clubs-map";
import { distanceKm, project, unproject } from "@/components/clubs-map/geo";
import { groupClubs } from "@/components/clubs-map/grouping";

function club(id: string, latitude: number, longitude: number): MapClub {
	return { id, name: id, latitude, longitude, location: null, logo: null };
}

test("unproject reverses project", () => {
	const [lat, lng] = unproject(project([43.8563, 18.4131], 10), 10);
	expect(lat).toBeCloseTo(43.8563, 6);
	expect(lng).toBeCloseTo(18.4131, 6);
});

test("distanceKm measures Sarajevo to Mostar", () => {
	expect(distanceKm([43.8563, 18.4131], [43.3438, 17.8078])).toBeCloseTo(70, -1);
});

test("clubs close together group at a low zoom and split at a high zoom", () => {
	const clubs = [club("a", 43.8563, 18.4131), club("b", 43.857, 18.414)];
	expect(groupClubs(clubs, 8)).toHaveLength(1);
	expect(groupClubs(clubs, 18)).toHaveLength(2);
});

test("clubs on one exact coordinate fan out once zoomed in", () => {
	const clubs = [club("a", 43.8563, 18.4131), club("b", 43.8563, 18.4131)];
	expect(groupClubs(clubs, 10)[0]?.spread).toBeNull();
	expect(groupClubs(clubs, 17)[0]?.spread).toHaveLength(2);
});
