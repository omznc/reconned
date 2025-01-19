"use server";

import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const validateSlug = safeActionClient
	.schema(
		z.object({
			type: z.union([z.literal("club"), z.literal("event"), z.literal("user")]),
			slug: z.string().min(1),
		}),
	)
	.action(async ({ parsedInput, ctx }) => {
		const user = await isAuthenticated();
		if (!user) {
			throw new Error(t("components.slug.errors.notAuthenticated"));
		}

		const { type, slug } = parsedInput;

		switch (type) {
			case "club": {
				const [clubBySlug, clubById] = await Promise.all([
					prisma.club.findUnique({
						where: { slug },
						select: { id: true },
					}),
					prisma.club.findUnique({
						where: { id: slug },
						select: { id: true },
					}),
				]);

				return !(clubBySlug || clubById);
			}
			case "event": {
				const [eventBySlug, eventById] = await Promise.all([
					prisma.event.findUnique({
						where: { slug },
						select: { id: true },
					}),
					prisma.event.findUnique({
						where: { id: slug },
						select: { id: true },
					}),
				]);

				return !(eventBySlug || eventById);
			}
			case "user": {
				const [userBySlug, userById] = await Promise.all([
					prisma.user.findUnique({
						where: { slug },
						select: { id: true },
					}),
					prisma.user.findUnique({
						where: { id: slug },
						select: { id: true },
					}),
				]);

				return !(userBySlug || userById);
			}
			default: {
				throw new Error(t("components.slug.errors.unknownType"));
			}
		}
	});
