#!/usr/bin/env bun

/**
 * Migration script to copy existing descriptions to the new JSON field
 * This script detects the language of existing descriptions and sets them appropriately
 * Run with: bun scripts/migrate-descriptions.ts
 */

import { detectLanguage } from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";

async function migrateUserBios() {
	console.log("Migrating user bios...");
	const users = await prisma.user.findMany({
		where: {
			bio: {
				not: null,
			},
		},
		select: {
			id: true,
			bio: true,
			bioJson: true,
		},
	});

	const usersToMigrate = users.filter((u) => !u.bioJson);

	console.log(`Found ${usersToMigrate.length} users with bios to migrate`);

	for (const user of usersToMigrate) {
		if (!user.bio) {
			continue;
		}

		// Detect language
		const detectedLocale = await detectLanguage(user.bio);
		const locale = detectedLocale || "bs"; // Default to Bosnian if detection fails

		console.log(`User ${user.id}: detected language ${locale}`);

		// Update with JSON field
		await prisma.user.update({
			where: { id: user.id },
			data: {
				bioJson: {
					[locale]: user.bio,
				},
			},
		});
	}

	console.log("User bios migration completed");
}

async function migrateClubDescriptions() {
	console.log("Migrating club descriptions...");
	const clubs = await prisma.club.findMany({
		where: {
			description: {
				not: null,
			},
		},
		select: {
			id: true,
			description: true,
			descriptionJson: true,
		},
	});

	const clubsToMigrate = clubs.filter((c) => !c.descriptionJson);

	console.log(`Found ${clubsToMigrate.length} clubs with descriptions to migrate`);

	for (const club of clubsToMigrate) {
		if (!club.description) {
			continue;
		}

		// Detect language
		const detectedLocale = await detectLanguage(club.description);
		const locale = detectedLocale || "bs"; // Default to Bosnian if detection fails

		console.log(`Club ${club.id}: detected language ${locale}`);

		// Update with JSON field
		await prisma.club.update({
			where: { id: club.id },
			data: {
				descriptionJson: {
					[locale]: club.description,
				},
			},
		});
	}

	console.log("Club descriptions migration completed");
}

async function migrateEventDescriptions() {
	console.log("Migrating event descriptions...");
	const events = await prisma.event.findMany({
		select: {
			id: true,
			description: true,
			descriptionJson: true,
		},
	});

	const eventsToMigrate = events.filter((event) => !event.descriptionJson);

	console.log(`Found ${eventsToMigrate.length} events with descriptions to migrate`);

	for (const event of eventsToMigrate) {
		if (!event.description) {
			continue;
		}

		// Detect language
		const detectedLocale = await detectLanguage(event.description);
		const locale = detectedLocale || "bs"; // Default to Bosnian if detection fails

		console.log(`Event ${event.id}: detected language ${locale}`);

		// Update with JSON field
		await prisma.event.update({
			where: { id: event.id },
			data: {
				descriptionJson: {
					[locale]: event.description,
				},
			},
		});
	}

	console.log("Event descriptions migration completed");
}

async function main() {
	console.log("Starting description migration...");

	try {
		await migrateUserBios();
		await migrateClubDescriptions();
		await migrateEventDescriptions();

		console.log("\n✅ Migration completed successfully!");
	} catch (error) {
		console.error("❌ Migration failed:", error);
		process.exit(1);
	} finally {
		await prisma.$disconnect();
	}
}

main();
