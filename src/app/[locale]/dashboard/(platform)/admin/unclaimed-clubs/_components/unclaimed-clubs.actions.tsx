"use server";

import { render } from "@react-email/components";
import { revalidateTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createUnclaimedClubSchema } from "@/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/unclaimed-club.schema";
import { validateSlug } from "@/components/slug/validate-slug";
import ClubClaimRequestEmail from "@/emails/club-claim-request";
import { revalidateLocalizedPaths } from "@/i18n/revalidateLocalizedPaths";
import { logClubAudit } from "@/lib/audit-logger";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { adminActionClient } from "@/lib/safe-action";
import { getS3FileUploadUrl } from "@/lib/storage";
import { addImageVersion } from "@/lib/utils";

const clubLogoUploadSchema = z.object({
	file: z.object({
		type: z.string().regex(/^image\//),
		size: z.number().max(1024 * 1024 * 4),
	}),
	clubId: z.string(),
});

const assignClubOwnerSchema = z.object({
	clubId: z.string(),
	userId: z.string(),
});
const claimClubRequestSchema = z.object({
	clubId: z.string(),
	message: z.string().optional(),
});

export const createUnclaimedClub = adminActionClient
	.inputSchema(createUnclaimedClubSchema.omit({ logo: true }))
	.action(async ({ parsedInput, ctx }) => {
		if (ctx.user.role !== "admin") {
			throw new ActionError("Unauthorized");
		}

		if (parsedInput.slug) {
			const valid = await validateSlug({
				type: "club",
				slug: parsedInput.slug,
			});
			if (!valid) {
				throw new ActionError("Izabrani link je već zauzet.");
			}
		}

		const club = await prisma.club.create({
			data: {
				name: parsedInput.name,
				location: parsedInput.location || null,
				description: parsedInput.description || null,
				dateFounded: parsedInput.dateFounded || null,
				isAllied: parsedInput.isAllied || false,
				isPrivate: parsedInput.isPrivate || false,
				isPrivateStats: parsedInput.isPrivateStats || false,
				logo: null,
				contactPhone: parsedInput.contactPhone || null,
				contactEmail: parsedInput.contactEmail || null,
				latitude: parsedInput.latitude || null,
				longitude: parsedInput.longitude || null,
				slug: parsedInput.slug ? parsedInput.slug : null,
				countryId: parsedInput.countryId,
				instagramUsername: parsedInput.instagramUsername || null,
				website: parsedInput.website || null,
			},
		});

		await logClubAudit({
			clubId: club.id,
			actionType: "CLUB_CREATE",
			actionData: {
				...parsedInput,
				dateFounded: parsedInput.dateFounded?.toISOString(),
				logo: false,
				createdByAdmin: true,
				unclaimed: true,
			},
		});

		if (env.NTFY_ENDPOINT) {
			await fetch(env.NTFY_ENDPOINT, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					title: "New unclaimed club created",
					message: `Club ${parsedInput.name} has been created by admin.`,
				}),
			});
		}

		revalidateTag("managed-clubs", "max");
		if (!club.isPrivate) {
			revalidateLocalizedPaths(`/clubs/${club.slug ?? club.id}`);
			revalidateLocalizedPaths("/clubs");
			revalidateLocalizedPaths("/search");
		}

		return { id: club.id };
	});

export const getUnclaimedClubLogoUploadUrl = adminActionClient
	.inputSchema(clubLogoUploadSchema)
	.action(async ({ parsedInput, ctx }) => {
		if (ctx.user.role !== "admin") {
			throw new ActionError("Unauthorized");
		}

		const club = await prisma.club.findUnique({
			where: { id: parsedInput.clubId },
			select: { id: true },
		});

		if (!club) {
			throw new ActionError("Club not found");
		}

		const key = `club/${parsedInput.clubId}/logo`;

		const resp = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key,
			clubId: parsedInput.clubId,
		});

		return resp;
	});

export const updateUnclaimedClubLogo = adminActionClient
	.inputSchema(
		z.object({
			clubId: z.string(),
			logo: z.string(),
		}),
	)
	.action(async ({ parsedInput, ctx }) => {
		if (ctx.user.role !== "admin") {
			throw new ActionError("Unauthorized");
		}

		const club = await prisma.club.update({
			where: { id: parsedInput.clubId },
			data: {
				logo: addImageVersion(parsedInput.logo),
			},
		});

		revalidateTag("managed-clubs", "max");
		if (!club.isPrivate) {
			revalidateLocalizedPaths(`/clubs/${club.slug ?? club.id}`);
			revalidateLocalizedPaths("/clubs");
			revalidateLocalizedPaths("/search");
		}

		return { success: true };
	});

export const assignClubOwner = adminActionClient
	.inputSchema(assignClubOwnerSchema)
	.action(async ({ parsedInput, ctx }) => {
		if (ctx.user.role !== "admin") {
			throw new ActionError("Unauthorized");
		}

		const existingOwner = await prisma.clubMembership.findFirst({
			where: {
				clubId: parsedInput.clubId,
				role: "CLUB_OWNER",
			},
		});

		if (existingOwner) {
			throw new ActionError("Club already has an owner");
		}

		await prisma.clubMembership.create({
			data: {
				clubId: parsedInput.clubId,
				userId: parsedInput.userId,
				role: "CLUB_OWNER",
			},
		});

		await logClubAudit({
			clubId: parsedInput.clubId,
			actionType: "CLUB_OWNER_ASSIGNED",
			actionData: {
				userId: parsedInput.userId,
				assignedBy: ctx.user.id,
			},
		});

		revalidateTag("managed-clubs", "max");
		const club = await prisma.club.findUnique({
			where: { id: parsedInput.clubId },
		});
		if (club && !club.isPrivate) {
			revalidateLocalizedPaths(`/clubs/${club.slug ?? club.id}`);
			revalidateLocalizedPaths("/clubs");
			revalidateLocalizedPaths("/search");
		}

		return { success: true };
	});

export const claimClubRequest = adminActionClient
	.inputSchema(claimClubRequestSchema)
	.action(async ({ parsedInput, ctx }) => {
		const club = await prisma.club.findUnique({
			where: { id: parsedInput.clubId },
		});

		if (!club) {
			throw new ActionError("Club not found");
		}

		const existingOwner = await prisma.clubMembership.findFirst({
			where: {
				clubId: parsedInput.clubId,
				role: "CLUB_OWNER",
			},
		});

		if (existingOwner) {
			throw new ActionError("Club already has an owner");
		}

		const admins = await prisma.user.findMany({
			where: {
				role: "admin",
			},
			select: {
				email: true,
			},
		});

		if (admins.length === 0) {
			throw new ActionError("No admins found");
		}

		const adminEmails = admins.map((admin) => admin.email);
		const t = await getTranslations();

		const emailHtml = await render(
			<ClubClaimRequestEmail
				clubName={club.name}
				clubLogo={club.logo}
				clubLocation={club.location}
				requesterName={ctx.user.name}
				requesterEmail={ctx.user.email}
				requesterCallsign={ctx.user.callsign ?? null}
				message={parsedInput.message || null}
				clubId={club.id}
			/>,
			{
				pretty: true,
			},
		);

		await sendEmail({
			to: adminEmails,
			subject: t("emails.clubClaimRequest.title", { clubName: club.name }),
			html: emailHtml,
		});

		return { success: true };
	});
