import type { BadgeTier } from "@generated/client";

export interface AchievementBadgeDefinition {
	slug: string;
	icon: string;
	tier: BadgeTier;
	description: string; // DB description for reference only
	// Check function to determine if user should earn this badge
	checkEligibility?: (data: {
		eventsAttended: number;
		clubMemberships: number;
		reviewsWritten: number;
		memberSinceDate: Date;
	}) => boolean;
}

export const ACHIEVEMENT_BADGES: AchievementBadgeDefinition[] = [
	// Event attendance badges
	{
		slug: "first-event",
		icon: "Sparkles",
		tier: "BRONZE",
		description: "Attended first event",
		checkEligibility: (data) => data.eventsAttended >= 1,
	},
	{
		slug: "event-enthusiast",
		icon: "Calendar",
		tier: "SILVER",
		description: "Attended 5 events",
		checkEligibility: (data) => data.eventsAttended >= 5,
	},
	{
		slug: "event-veteran",
		icon: "CalendarCheck",
		tier: "GOLD",
		description: "Attended 10 events",
		checkEligibility: (data) => data.eventsAttended >= 10,
	},
	{
		slug: "event-legend",
		icon: "CalendarDays",
		tier: "PLATINUM",
		description: "Attended 25 events",
		checkEligibility: (data) => data.eventsAttended >= 25,
	},
	{
		slug: "event-master",
		icon: "Trophy",
		tier: "DIAMOND",
		description: "Attended 50 events",
		checkEligibility: (data) => data.eventsAttended >= 50,
	},

	// Club membership badges
	{
		slug: "club-member",
		icon: "Users",
		tier: "BRONZE",
		description: "Joined a club",
		checkEligibility: (data) => data.clubMemberships >= 1,
	},
	{
		slug: "club-networker",
		icon: "Network",
		tier: "SILVER",
		description: "Member of 2 clubs",
		checkEligibility: (data) => data.clubMemberships >= 2,
	},
	{
		slug: "club-ambassador",
		icon: "Users2",
		tier: "GOLD",
		description: "Member of 3 or more clubs",
		checkEligibility: (data) => data.clubMemberships >= 3,
	},

	// Review badges
	{
		slug: "first-review",
		icon: "MessageSquare",
		tier: "BRONZE",
		description: "Written first review",
		checkEligibility: (data) => data.reviewsWritten >= 1,
	},
	{
		slug: "critic",
		icon: "Star",
		tier: "SILVER",
		description: "Written 5 reviews",
		checkEligibility: (data) => data.reviewsWritten >= 5,
	},
	{
		slug: "super-critic",
		icon: "Stars",
		tier: "GOLD",
		description: "Written 10 reviews",
		checkEligibility: (data) => data.reviewsWritten >= 10,
	},

	// Loyalty badges
	{
		slug: "one-year-member",
		icon: "Award",
		tier: "SILVER",
		description: "Member for 1 year",
		checkEligibility: (data) => {
			const oneYearAgo = new Date();
			oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
			return data.memberSinceDate <= oneYearAgo;
		},
	},
	{
		slug: "two-year-member",
		icon: "Medal",
		tier: "GOLD",
		description: "Member for 2 years",
		checkEligibility: (data) => {
			const twoYearsAgo = new Date();
			twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
			return data.memberSinceDate <= twoYearsAgo;
		},
	},
	{
		slug: "five-year-member",
		icon: "Crown",
		tier: "DIAMOND",
		description: "Member for 5 years",
		checkEligibility: (data) => {
			const fiveYearsAgo = new Date();
			fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
			return data.memberSinceDate <= fiveYearsAgo;
		},
	},

	// Early adopter badge
	{
		slug: "early-adopter",
		icon: "Rocket",
		tier: "PLATINUM",
		description: "Early adopter of the platform",
		checkEligibility: (data) => {
			// Check if member joined before 2025-01-01
			const earlyAdopterDate = new Date("2025-01-01");
			return data.memberSinceDate < earlyAdopterDate;
		},
	},
];
