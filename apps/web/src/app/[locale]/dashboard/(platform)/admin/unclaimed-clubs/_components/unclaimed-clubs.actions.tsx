import type { z } from "zod";
import apiClient from "@/lib/api";
import { addImageVersion } from "@/lib/utils";
import type { createUnclaimedClubSchema } from "./unclaimed-club.schema";

type CreateUnclaimedClubInput = Omit<z.infer<typeof createUnclaimedClubSchema>, "logo" | "headerImage">;

export async function createUnclaimedClub(body: CreateUnclaimedClubInput) {
	return apiClient.POST("/api/admin/unclaimed-clubs", {
		body: {
			...body,
			dateFounded: body.dateFounded ? body.dateFounded.toISOString() : undefined,
			instagramUsername: body.instagramUsername || undefined,
		},
	});
}

export async function getUnclaimedClubLogoUploadUrl(params: { clubId: string; file: { type: string; size: number } }) {
	return apiClient.POST("/api/admin/unclaimed-clubs/{id}/logo/upload-url", {
		params: { path: { id: params.clubId } },
		body: { file: params.file },
	});
}

export async function updateUnclaimedClubLogo(params: { clubId: string; logo: string }) {
	return apiClient.PUT("/api/admin/unclaimed-clubs/{id}/logo", {
		params: { path: { id: params.clubId } },
		body: { logo: addImageVersion(params.logo) },
	});
}

export async function getUnclaimedClubHeaderImageUploadUrl(params: {
	clubId: string;
	file: { type: string; size: number };
}) {
	return apiClient.POST("/api/admin/unclaimed-clubs/{id}/header-image/upload-url", {
		params: { path: { id: params.clubId } },
		body: { file: params.file },
	});
}

export async function updateUnclaimedClubHeaderImage(params: { clubId: string; headerImage: string }) {
	return apiClient.PUT("/api/admin/unclaimed-clubs/{id}/header-image", {
		params: { path: { id: params.clubId } },
		body: { headerImage: addImageVersion(params.headerImage) },
	});
}

export async function assignClubOwner(params: { clubId: string; userId: string }) {
	return apiClient.POST("/api/admin/unclaimed-clubs/{id}/assign-owner", {
		params: { path: { id: params.clubId } },
		body: { userId: params.userId },
	});
}

export async function claimClubRequest(params: { clubId: string; message?: string }) {
	return apiClient.POST("/api/admin/unclaimed-clubs/{id}/claim-request", {
		params: { path: { id: params.clubId } },
		body: { message: params.message },
	});
}
