import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
	club,
	clubInvite,
	clubMembership,
	clubRule,
	event,
	eventRegistration,
	post,
	review,
	user,
} from "../drizzle/schema";
import { auth } from "../lib/auth";
import { db } from "../lib/db";

const WRITE_TOOLS = new Set([
	"update_profile",
	"update_user_theme",
	"update_user_font",
	"update_user_style",
	"update_user_language",
	"create_club",
	"update_club",
	"delete_club",
	"create_club_rule",
	"update_club_rule",
	"delete_club_rule",
	"create_club_post",
	"update_club_post",
	"delete_club_post",
	"add_club_member",
	"remove_club_member",
	"extend_membership",
	"leave_club",
	"create_event",
	"delete_event",
	"update_event",
	"register_for_event",
	"update_registration_attendance",
	"create_review",
]);

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS = 300;
const MAX_WRITES = 30;

const mcpRateLimits = new Map<string, RateLimitEntry>();
const mcpWriteRateLimits = new Map<string, RateLimitEntry>();

setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of mcpRateLimits) {
		if (now > entry.resetAt) mcpRateLimits.delete(key);
	}
	for (const [key, entry] of mcpWriteRateLimits) {
		if (now > entry.resetAt) mcpWriteRateLimits.delete(key);
	}
}, 60_000).unref();

function checkRateLimit(map: Map<string, RateLimitEntry>, key: string, max: number): boolean {
	const now = Date.now();
	const entry = map.get(key);
	if (entry) {
		if (now > entry.resetAt) {
			map.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
			return true;
		}
		if (entry.count >= max) return false;
		entry.count++;
		return true;
	}
	map.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
	return true;
}

async function isClubManager(clubId: string, userId: string): Promise<boolean> {
	const membership = await db
		.select()
		.from(clubMembership)
		.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, userId)))
		.limit(1);
	return membership[0]?.role === "MANAGER" || membership[0]?.role === "CLUB_OWNER";
}

async function isClubOwner(clubId: string, userId: string): Promise<boolean> {
	const membership = await db
		.select()
		.from(clubMembership)
		.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, userId)))
		.limit(1);
	return membership[0]?.role === "CLUB_OWNER";
}

async function getUserMembership(clubId: string, userId: string) {
	const membership = await db
		.select()
		.from(clubMembership)
		.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, userId)))
		.limit(1);
	return membership[0] || null;
}

const TOOLS: Tool[] = [
	{
		name: "get_profile",
		description: "Get the current user's profile information",
		inputSchema: { type: "object" as const, properties: {} },
	},
	{
		name: "update_profile",
		description: "Update the current user's profile. Only provide fields you want to change.",
		inputSchema: {
			type: "object" as const,
			properties: {
				name: { type: "string", description: "User's display name" },
				bio: { type: "string", description: "User's bio" },
				location: { type: "string", description: "User's location" },
				website: { type: "string", description: "User's website URL" },
				phone: { type: "string", description: "User's phone number" },
				callsign: { type: "string", description: "User's callsign" },
			},
		},
	},
	{
		name: "get_user",
		description: "Get a user by their ID",
		inputSchema: {
			type: "object" as const,
			properties: {
				userId: { type: "string", description: "The user ID" },
			},
			required: ["userId"],
		},
	},
	{
		name: "list_users",
		description: "List users with pagination",
		inputSchema: {
			type: "object" as const,
			properties: {
				limit: { type: "number", description: "Number of users to return (default 20)" },
				offset: { type: "number", description: "Number of users to skip (default 0)" },
			},
		},
	},
	{
		name: "get_user_profile",
		description: "Get a user's public profile information",
		inputSchema: {
			type: "object" as const,
			properties: {
				userId: { type: "string", description: "The user ID" },
			},
			required: ["userId"],
		},
	},
	{
		name: "get_user_stats",
		description: "Get statistics for a user (event count, club count, etc.)",
		inputSchema: {
			type: "object" as const,
			properties: {
				userId: { type: "string", description: "The user ID" },
			},
			required: ["userId"],
		},
	},
	{
		name: "get_pending_invites",
		description: "Get all pending club invites for the current user",
		inputSchema: { type: "object" as const, properties: {} },
	},
	{
		name: "get_invites_count",
		description: "Get the count of pending invites for the current user",
		inputSchema: { type: "object" as const, properties: {} },
	},
	{
		name: "get_daily_quota",
		description: "Get the current user's daily upload quota information",
		inputSchema: { type: "object" as const, properties: {} },
	},
	{
		name: "update_user_theme",
		description: "Update the current user's theme preference",
		inputSchema: {
			type: "object" as const,
			properties: {
				theme: { type: "string", description: "Theme name (e.g., 'dark', 'light')" },
			},
			required: ["theme"],
		},
	},
	{
		name: "update_user_font",
		description: "Update the current user's font preference",
		inputSchema: {
			type: "object" as const,
			properties: {
				font: { type: "string", description: "Font name (e.g., 'mono', 'sans')" },
			},
			required: ["font"],
		},
	},
	{
		name: "update_user_style",
		description: "Update the current user's style preference",
		inputSchema: {
			type: "object" as const,
			properties: {
				style: { type: "string", description: "Style name (e.g., 'relaxed', 'compact')" },
			},
			required: ["style"],
		},
	},
	{
		name: "update_user_language",
		description: "Update the current user's language preference",
		inputSchema: {
			type: "object" as const,
			properties: {
				language: { type: "string", description: "Language code (e.g., 'bs', 'en')" },
			},
			required: ["language"],
		},
	},
	{
		name: "list_clubs",
		description: "List all clubs the current user is a member of",
		inputSchema: { type: "object" as const, properties: {} },
	},
	{
		name: "get_club",
		description: "Get detailed information about a specific club",
		inputSchema: {
			type: "object" as const,
			properties: {
				clubId: { type: "string", description: "The club ID" },
			},
			required: ["clubId"],
		},
	},
	{
		name: "list_club_members",
		description: "List members of a specific club",
		inputSchema: {
			type: "object" as const,
			properties: {
				clubId: { type: "string", description: "The club ID" },
			},
			required: ["clubId"],
		},
	},
	{
		name: "create_club",
		description: "Create a new club",
		inputSchema: {
			type: "object" as const,
			properties: {
				name: { type: "string", description: "Club name" },
				description: { type: "string", description: "Club description" },
				location: { type: "string", description: "Club location" },
				isPrivate: { type: "boolean", description: "Whether the club is private" },
			},
			required: ["name"],
		},
	},
	{
		name: "update_club",
		description: "Update club information (requires club owner)",
		inputSchema: {
			type: "object" as const,
			properties: {
				clubId: { type: "string", description: "The club ID" },
				name: { type: "string", description: "Club name" },
				description: { type: "string", description: "Club description" },
				location: { type: "string", description: "Club location" },
				website: { type: "string", description: "Club website" },
				contactEmail: { type: "string", description: "Contact email" },
				contactPhone: { type: "string", description: "Contact phone" },
			},
			required: ["clubId"],
		},
	},
	{
		name: "get_club_rules",
		description: "Get all rules for a club (requires manager/owner)",
		inputSchema: {
			type: "object" as const,
			properties: {
				clubId: { type: "string", description: "The club ID" },
			},
			required: ["clubId"],
		},
	},
	{
		name: "get_club_rule",
		description: "Get a specific club rule by ID (requires manager/owner)",
		inputSchema: {
			type: "object" as const,
			properties: {
				ruleId: { type: "string", description: "The rule ID" },
			},
			required: ["ruleId"],
		},
	},
	{
		name: "create_club_rule",
		description: "Create a new club rule (requires manager/owner)",
		inputSchema: {
			type: "object" as const,
			properties: {
				clubId: { type: "string", description: "The club ID" },
				name: { type: "string", description: "Rule name" },
				description: { type: "string", description: "Rule description" },
				content: { type: "string", description: "Rule content" },
			},
			required: ["clubId", "name", "content"],
		},
	},
	{
		name: "update_club_rule",
		description: "Update a club rule (requires manager/owner)",
		inputSchema: {
			type: "object" as const,
			properties: {
				ruleId: { type: "string", description: "The rule ID" },
				name: { type: "string", description: "Rule name" },
				description: { type: "string", description: "Rule description" },
				content: { type: "string", description: "Rule content" },
			},
			required: ["ruleId"],
		},
	},
	{
		name: "delete_club_rule",
		description: "Delete a club rule (requires manager/owner)",
		inputSchema: {
			type: "object" as const,
			properties: {
				ruleId: { type: "string", description: "The rule ID" },
			},
			required: ["ruleId"],
		},
	},
	{
		name: "get_club_posts",
		description: "Get posts for a club",
		inputSchema: {
			type: "object" as const,
			properties: {
				clubId: { type: "string", description: "The club ID" },
			},
			required: ["clubId"],
		},
	},
	{
		name: "get_club_post",
		description: "Get a specific club post by ID",
		inputSchema: {
			type: "object" as const,
			properties: {
				postId: { type: "string", description: "The post ID" },
			},
			required: ["postId"],
		},
	},
	{
		name: "create_club_post",
		description: "Create a new club post (requires manager/owner)",
		inputSchema: {
			type: "object" as const,
			properties: {
				clubId: { type: "string", description: "The club ID" },
				title: { type: "string", description: "Post title" },
				content: { type: "string", description: "Post content" },
				images: { type: "array", items: { type: "string" }, description: "Image URLs" },
				isPublic: { type: "boolean", description: "Whether post is public" },
			},
			required: ["clubId", "title", "content"],
		},
	},
	{
		name: "update_club_post",
		description: "Update a club post (requires manager/owner)",
		inputSchema: {
			type: "object" as const,
			properties: {
				postId: { type: "string", description: "The post ID" },
				title: { type: "string", description: "Post title" },
				content: { type: "string", description: "Post content" },
				images: { type: "array", items: { type: "string" }, description: "Image URLs" },
				isPublic: { type: "boolean", description: "Whether post is public" },
			},
			required: ["postId"],
		},
	},
	{
		name: "add_club_member",
		description: "Add a member to a club (requires manager/owner)",
		inputSchema: {
			type: "object" as const,
			properties: {
				clubId: { type: "string", description: "The club ID" },
				userId: { type: "string", description: "The user ID to add" },
				role: { type: "string", description: "Role to assign (USER, MANAGER)" },
			},
			required: ["clubId", "userId"],
		},
	},
	{
		name: "remove_club_member",
		description: "Remove a member from a club (requires manager, not owner)",
		inputSchema: {
			type: "object" as const,
			properties: {
				clubId: { type: "string", description: "The club ID" },
				userId: { type: "string", description: "The user ID to remove" },
			},
			required: ["clubId", "userId"],
		},
	},
	{
		name: "extend_membership",
		description: "Extend a club membership (requires manager/owner)",
		inputSchema: {
			type: "object" as const,
			properties: {
				clubId: { type: "string", description: "The club ID" },
				userId: { type: "string", description: "The user ID" },
				endDate: { type: "string", description: "New end date (ISO string)" },
			},
			required: ["clubId", "userId", "endDate"],
		},
	},
	{
		name: "leave_club",
		description: "Leave a club",
		inputSchema: {
			type: "object" as const,
			properties: {
				clubId: { type: "string", description: "The club ID" },
			},
			required: ["clubId"],
		},
	},
	{
		name: "list_events",
		description: "List events. Optionally filter by club ID.",
		inputSchema: {
			type: "object" as const,
			properties: {
				clubId: { type: "string", description: "Optional club ID to filter events" },
			},
		},
	},
	{
		name: "get_event",
		description: "Get detailed information about a specific event",
		inputSchema: {
			type: "object" as const,
			properties: {
				eventId: { type: "string", description: "The event ID" },
			},
			required: ["eventId"],
		},
	},
	{
		name: "register_for_event",
		description: "Register the current user for an event",
		inputSchema: {
			type: "object" as const,
			properties: {
				eventId: { type: "string", description: "The event ID to register for" },
			},
			required: ["eventId"],
		},
	},
	{
		name: "list_event_registrations",
		description: "List registrations for a specific event",
		inputSchema: {
			type: "object" as const,
			properties: {
				eventId: { type: "string", description: "The event ID" },
			},
			required: ["eventId"],
		},
	},
	{
		name: "create_event",
		description: "Create a new event (requires manager/owner)",
		inputSchema: {
			type: "object" as const,
			properties: {
				clubId: { type: "string", description: "The club ID" },
				name: { type: "string", description: "Event name" },
				description: { type: "string", description: "Event description" },
				dateStart: { type: "string", description: "Start date (ISO string)" },
				dateEnd: { type: "string", description: "End date (ISO string)" },
				dateRegistrationsOpen: { type: "string", description: "Registration open date (ISO string)" },
				dateRegistrationsClose: { type: "string", description: "Registration close date (ISO string)" },
				location: { type: "string", description: "Event location" },
				costPerPerson: { type: "number", description: "Cost per person" },
				isPrivate: { type: "boolean", description: "Whether event is private" },
				allowFreelancers: { type: "boolean", description: "Allow freelancers" },
				hasBreakfast: { type: "boolean", description: "Has breakfast" },
				hasLunch: { type: "boolean", description: "Has lunch" },
				hasDinner: { type: "boolean", description: "Has dinner" },
				hasSnacks: { type: "boolean", description: "Has snacks" },
				hasDrinks: { type: "boolean", description: "Has drinks" },
				hasPrizes: { type: "boolean", description: "Has prizes" },
			},
			required: [
				"clubId",
				"name",
				"description",
				"dateStart",
				"dateEnd",
				"dateRegistrationsOpen",
				"dateRegistrationsClose",
				"location",
			],
		},
	},
	{
		name: "update_event",
		description: "Update an event (requires manager/owner)",
		inputSchema: {
			type: "object" as const,
			properties: {
				eventId: { type: "string", description: "The event ID" },
				name: { type: "string", description: "Event name" },
				description: { type: "string", description: "Event description" },
				dateStart: { type: "string", description: "Start date (ISO string)" },
				dateEnd: { type: "string", description: "End date (ISO string)" },
				dateRegistrationsOpen: { type: "string", description: "Registration open date (ISO string)" },
				dateRegistrationsClose: { type: "string", description: "Registration close date (ISO string)" },
				location: { type: "string", description: "Event location" },
				costPerPerson: { type: "number", description: "Cost per person" },
				isPrivate: { type: "boolean", description: "Whether event is private" },
			},
			required: ["eventId"],
		},
	},
	{
		name: "get_event_rules",
		description: "Get rules for an event",
		inputSchema: {
			type: "object" as const,
			properties: {
				eventId: { type: "string", description: "The event ID" },
			},
			required: ["eventId"],
		},
	},
	{
		name: "get_registrations_count",
		description: "Get the count of registrations for an event",
		inputSchema: {
			type: "object" as const,
			properties: {
				eventId: { type: "string", description: "The event ID" },
			},
			required: ["eventId"],
		},
	},
	{
		name: "update_registration_attendance",
		description: "Update attendance for an event registration (requires manager/owner)",
		inputSchema: {
			type: "object" as const,
			properties: {
				registrationId: { type: "string", description: "The registration ID" },
				attended: { type: "boolean", description: "Whether the user attended" },
			},
			required: ["registrationId", "attended"],
		},
	},
	{
		name: "create_review",
		description: "Create or update a review",
		inputSchema: {
			type: "object" as const,
			properties: {
				type: { type: "string", description: "Review type (USER, CLUB, EVENT)" },
				rating: { type: "number", description: "Rating (1-5)" },
				content: { type: "string", description: "Review content" },
				userId: { type: "string", description: "User ID (for USER type reviews)" },
				clubId: { type: "string", description: "Club ID (for CLUB type reviews)" },
				eventId: { type: "string", description: "Event ID (for EVENT type reviews)" },
			},
			required: ["type", "rating", "content"],
		},
	},
];

const toolArgsSchemas = {
	update_profile: z.object({
		name: z.string().optional(),
		bio: z.string().optional(),
		location: z.string().optional(),
		website: z.string().optional(),
		phone: z.string().optional(),
		callsign: z.string().optional(),
	}),
	get_user: z.object({
		userId: z.string(),
	}),
	list_users: z.object({
		limit: z.number().optional(),
		offset: z.number().optional(),
	}),
	get_user_profile: z.object({
		userId: z.string(),
	}),
	get_user_stats: z.object({
		userId: z.string(),
	}),
	update_user_theme: z.object({
		theme: z.string(),
	}),
	update_user_font: z.object({
		font: z.string(),
	}),
	update_user_style: z.object({
		style: z.string(),
	}),
	update_user_language: z.object({
		language: z.string(),
	}),
	get_club: z.object({
		clubId: z.string(),
	}),
	list_club_members: z.object({
		clubId: z.string(),
	}),
	create_club: z.object({
		name: z.string(),
		description: z.string().optional(),
		location: z.string().optional(),
		isPrivate: z.boolean().optional(),
	}),
	update_club: z.object({
		clubId: z.string(),
		name: z.string().optional(),
		description: z.string().optional(),
		location: z.string().optional(),
		website: z.string().optional(),
		contactEmail: z.string().optional(),
		contactPhone: z.string().optional(),
	}),
	get_club_rules: z.object({
		clubId: z.string(),
	}),
	get_club_rule: z.object({
		ruleId: z.string(),
	}),
	create_club_rule: z.object({
		clubId: z.string(),
		name: z.string(),
		description: z.string().optional(),
		content: z.string(),
	}),
	update_club_rule: z.object({
		ruleId: z.string(),
		name: z.string().optional(),
		description: z.string().optional(),
		content: z.string().optional(),
	}),
	delete_club_rule: z.object({
		ruleId: z.string(),
	}),
	get_club_posts: z.object({
		clubId: z.string(),
	}),
	get_club_post: z.object({
		postId: z.string(),
	}),
	create_club_post: z.object({
		clubId: z.string(),
		title: z.string(),
		content: z.string(),
		images: z.array(z.string()).optional(),
		isPublic: z.boolean().optional(),
	}),
	update_club_post: z.object({
		postId: z.string(),
		title: z.string().optional(),
		content: z.string().optional(),
		images: z.array(z.string()).optional(),
		isPublic: z.boolean().optional(),
	}),
	add_club_member: z.object({
		clubId: z.string(),
		userId: z.string(),
		role: z.string().optional(),
	}),
	remove_club_member: z.object({
		clubId: z.string(),
		userId: z.string(),
	}),
	extend_membership: z.object({
		clubId: z.string(),
		userId: z.string(),
		endDate: z.string(),
	}),
	leave_club: z.object({
		clubId: z.string(),
	}),
	list_events: z.object({
		clubId: z.string().optional(),
	}),
	get_event: z.object({
		eventId: z.string(),
	}),
	list_event_registrations: z.object({
		eventId: z.string(),
	}),
	register_for_event: z.object({
		eventId: z.string(),
	}),
	create_event: z.object({
		clubId: z.string(),
		name: z.string(),
		description: z.string(),
		dateStart: z.string(),
		dateEnd: z.string(),
		dateRegistrationsOpen: z.string(),
		dateRegistrationsClose: z.string(),
		location: z.string(),
		costPerPerson: z.number().optional(),
		isPrivate: z.boolean().optional(),
		allowFreelancers: z.boolean().optional(),
		hasBreakfast: z.boolean().optional(),
		hasLunch: z.boolean().optional(),
		hasDinner: z.boolean().optional(),
		hasSnacks: z.boolean().optional(),
		hasDrinks: z.boolean().optional(),
		hasPrizes: z.boolean().optional(),
	}),
	update_event: z.object({
		eventId: z.string(),
		name: z.string().optional(),
		description: z.string().optional(),
		dateStart: z.string().optional(),
		dateEnd: z.string().optional(),
		dateRegistrationsOpen: z.string().optional(),
		dateRegistrationsClose: z.string().optional(),
		location: z.string().optional(),
		costPerPerson: z.number().optional(),
		isPrivate: z.boolean().optional(),
	}),
	get_event_rules: z.object({
		eventId: z.string(),
	}),
	get_registrations_count: z.object({
		eventId: z.string(),
	}),
	update_registration_attendance: z.object({
		registrationId: z.string(),
		attended: z.boolean(),
	}),
	create_review: z.object({
		type: z.enum(["USER", "CLUB", "EVENT"]),
		rating: z.number().min(1).max(5),
		content: z.string(),
		userId: z.string().optional(),
		clubId: z.string().optional(),
		eventId: z.string().optional(),
	}),
};

export async function handleMCPRequest(request: Request): Promise<Response> {
	const url = new URL(request.url);
	if (url.pathname !== "/api/mcp") {
		return new Response("Not Found", { status: 404 });
	}

	if (request.method !== "POST" && request.method !== "GET") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session?.user) {
		return new Response(
			JSON.stringify({
				jsonrpc: "2.0",
				error: { code: -32001, message: "Unauthorized" },
				id: null,
			}),
			{ status: 401, headers: { "Content-Type": "application/json" } },
		);
	}

	const userId = session.user.id;

	if (!checkRateLimit(mcpRateLimits, userId, MAX_REQUESTS)) {
		return new Response(
			JSON.stringify({
				jsonrpc: "2.0",
				error: {
					code: -32002,
					message: `Rate limit exceeded. Limited to ${MAX_REQUESTS} requests/minute.`,
				},
				id: null,
			}),
			{ status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } },
		);
	}

	const server = new Server(
		{
			name: "reconned-mcp",
			version: "1.0.0",
		},
		{
			capabilities: {
				tools: {},
			},
		},
	);

	server.setRequestHandler(ListToolsRequestSchema, async () => {
		return { tools: TOOLS };
	});

	server.setRequestHandler(CallToolRequestSchema, async (req) => {
		const { name, arguments: args } = req.params;

		if (WRITE_TOOLS.has(name) && !checkRateLimit(mcpWriteRateLimits, userId, MAX_WRITES)) {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							error: `Write rate limit exceeded. Limited to ${MAX_WRITES} writes per minute.`,
						}),
					},
				],
				isError: true,
			};
		}

		try {
			let result: unknown;

			switch (name) {
				case "get_profile": {
					const profile = await db
						.select({
							id: user.id,
							name: user.name,
							email: user.email,
							bio: user.bio,
							location: user.location,
							website: user.website,
							phone: user.phone,
							callsign: user.callsign,
							image: user.image,
							language: user.language,
							theme: user.theme,
							font: user.font,
							style: user.style,
						})
						.from(user)
						.where(eq(user.id, userId))
						.limit(1);
					result = profile[0] || null;
					break;
				}

				case "update_profile": {
					const parsed = toolArgsSchemas.update_profile.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const updateData = {
						...parsed.data,
						updatedAt: new Date().toISOString(),
					};
					await db.update(user).set(updateData).where(eq(user.id, userId));
					result = { success: true };
					break;
				}

				case "get_user": {
					const parsed = toolArgsSchemas.get_user.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const userData = await db
						.select({
							id: user.id,
							name: user.name,
							email: user.email,
							bio: user.bio,
							image: user.image,
							location: user.location,
							callsign: user.callsign,
						})
						.from(user)
						.where(eq(user.id, parsed.data.userId))
						.limit(1);
					result = userData[0] || null;
					break;
				}

				case "list_users": {
					const parsed = toolArgsSchemas.list_users.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const limit = parsed.data.limit || 20;
					const offset = parsed.data.offset || 0;
					const users = await db
						.select({
							id: user.id,
							name: user.name,
							email: user.email,
							image: user.image,
							bio: user.bio,
						})
						.from(user)
						.limit(limit)
						.offset(offset);
					result = users;
					break;
				}

				case "get_user_profile": {
					const parsed = toolArgsSchemas.get_user_profile.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const userData = await db
						.select({
							id: user.id,
							name: user.name,
							image: user.image,
							bio: user.bio,
							location: user.location,
							callsign: user.callsign,
							createdAt: user.createdAt,
						})
						.from(user)
						.where(eq(user.id, parsed.data.userId))
						.limit(1);
					result = userData[0] || null;
					break;
				}

				case "get_user_stats": {
					const parsed = toolArgsSchemas.get_user_stats.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const [clubCount] = await db
						.select({ count: count() })
						.from(clubMembership)
						.where(eq(clubMembership.userId, parsed.data.userId));
					const [eventCount] = await db
						.select({ count: count() })
						.from(eventRegistration)
						.where(eq(eventRegistration.createdById, parsed.data.userId));
					result = {
						clubs: clubCount?.count || 0,
						events: eventCount?.count || 0,
					};
					break;
				}

				case "get_pending_invites": {
					const invites = await db
						.select({
							id: clubInvite.id,
							email: clubInvite.email,
							clubId: clubInvite.clubId,
							status: clubInvite.status,
							expiresAt: clubInvite.expiresAt,
							createdAt: clubInvite.createdAt,
						})
						.from(clubInvite)
						.where(and(eq(clubInvite.userId, userId), eq(clubInvite.status, "PENDING")));
					result = invites;
					break;
				}

				case "get_invites_count": {
					const [countResult] = await db
						.select({ count: count() })
						.from(clubInvite)
						.where(and(eq(clubInvite.userId, userId), eq(clubInvite.status, "PENDING")));
					result = { count: countResult?.count || 0 };
					break;
				}

				case "get_daily_quota": {
					result = {
						uploadLimit: "10MB",
						used: "0MB",
						remaining: "10MB",
					};
					break;
				}

				case "update_user_theme": {
					const parsed = toolArgsSchemas.update_user_theme.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					await db
						.update(user)
						.set({ theme: parsed.data.theme, updatedAt: new Date().toISOString() })
						.where(eq(user.id, userId));
					result = { success: true };
					break;
				}

				case "update_user_font": {
					const parsed = toolArgsSchemas.update_user_font.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					await db
						.update(user)
						.set({ font: parsed.data.font, updatedAt: new Date().toISOString() })
						.where(eq(user.id, userId));
					result = { success: true };
					break;
				}

				case "update_user_style": {
					const parsed = toolArgsSchemas.update_user_style.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					await db
						.update(user)
						.set({ style: parsed.data.style, updatedAt: new Date().toISOString() })
						.where(eq(user.id, userId));
					result = { success: true };
					break;
				}

				case "update_user_language": {
					const parsed = toolArgsSchemas.update_user_language.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					await db
						.update(user)
						.set({ language: parsed.data.language, updatedAt: new Date().toISOString() })
						.where(eq(user.id, userId));
					result = { success: true };
					break;
				}

				case "list_clubs": {
					const memberships = await db.select().from(clubMembership).where(eq(clubMembership.userId, userId));

					const clubs = await Promise.all(
						memberships.map(async (membership) => {
							const clubData = await db
								.select()
								.from(club)
								.where(eq(club.id, membership.clubId))
								.limit(1);
							return {
								membership: {
									id: membership.id,
									role: membership.role,
									startDate: membership.startDate,
									endDate: membership.endDate,
								},
								club: clubData[0] || null,
							};
						}),
					);
					result = clubs;
					break;
				}

				case "get_club": {
					const parsed = toolArgsSchemas.get_club.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const clubData = await db.select().from(club).where(eq(club.id, parsed.data.clubId)).limit(1);

					const members = await db
						.select()
						.from(clubMembership)
						.where(eq(clubMembership.clubId, parsed.data.clubId));

					result = {
						club: clubData[0] || null,
						members: members.map((m) => ({
							id: m.id,
							userId: m.userId,
							role: m.role,
							startDate: m.startDate,
							endDate: m.endDate,
						})),
					};
					break;
				}

				case "list_club_members": {
					const parsed = toolArgsSchemas.list_club_members.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const members = await db
						.select({
							id: clubMembership.id,
							userId: clubMembership.userId,
							role: clubMembership.role,
							startDate: clubMembership.startDate,
							endDate: clubMembership.endDate,
							userName: user.name,
							userEmail: user.email,
						})
						.from(clubMembership)
						.innerJoin(user, eq(clubMembership.userId, user.id))
						.where(eq(clubMembership.clubId, parsed.data.clubId));
					result = members;
					break;
				}

				case "create_club": {
					const parsed = toolArgsSchemas.create_club.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const newClubId = crypto.randomUUID();
					const now = new Date().toISOString();
					const newClub = await db
						.insert(club)
						.values({
							id: newClubId,
							name: parsed.data.name,
							description: parsed.data.description || null,
							location: parsed.data.location || null,
							isPrivate: parsed.data.isPrivate || false,
							createdAt: now,
							updatedAt: now,
						})
						.returning();

					await db.insert(clubMembership).values({
						id: crypto.randomUUID(),
						userId: userId,
						clubId: newClubId,
						role: "CLUB_OWNER",
						createdAt: now,
						updatedAt: now,
					});

					result = newClub[0];
					break;
				}

				case "update_club": {
					const parsed = toolArgsSchemas.update_club.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					if (!(await isClubOwner(parsed.data.clubId, userId))) {
						throw new Error("Only club owner can update club information");
					}
					const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
					if (parsed.data.name) updateData.name = parsed.data.name;
					if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
					if (parsed.data.location !== undefined) updateData.location = parsed.data.location;
					if (parsed.data.website !== undefined) updateData.website = parsed.data.website;
					if (parsed.data.contactEmail !== undefined) updateData.contactEmail = parsed.data.contactEmail;
					if (parsed.data.contactPhone !== undefined) updateData.contactPhone = parsed.data.contactPhone;

					await db.update(club).set(updateData).where(eq(club.id, parsed.data.clubId));
					result = { success: true };
					break;
				}

				case "get_club_rules": {
					const parsed = toolArgsSchemas.get_club_rules.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					if (!(await isClubManager(parsed.data.clubId, userId))) {
						throw new Error("Only club managers and owners can view rules");
					}
					const rules = await db.select().from(clubRule).where(eq(clubRule.clubId, parsed.data.clubId));
					result = rules;
					break;
				}

				case "get_club_rule": {
					const parsed = toolArgsSchemas.get_club_rule.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const rule = await db.select().from(clubRule).where(eq(clubRule.id, parsed.data.ruleId)).limit(1);
					if (rule[0] && !(await isClubManager(rule[0].clubId, userId))) {
						throw new Error("Only club managers and owners can view rules");
					}
					result = rule[0] || null;
					break;
				}

				case "create_club_rule": {
					const parsed = toolArgsSchemas.create_club_rule.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					if (!(await isClubManager(parsed.data.clubId, userId))) {
						throw new Error("Only club managers and owners can create rules");
					}
					const now = new Date().toISOString();
					const newRule = await db
						.insert(clubRule)
						.values({
							id: crypto.randomUUID(),
							clubId: parsed.data.clubId,
							name: parsed.data.name,
							description: parsed.data.description || null,
							content: parsed.data.content,
							createdAt: now,
							updatedAt: now,
						})
						.returning();
					result = newRule[0];
					break;
				}

				case "update_club_rule": {
					const parsed = toolArgsSchemas.update_club_rule.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const existingRule = await db
						.select()
						.from(clubRule)
						.where(eq(clubRule.id, parsed.data.ruleId))
						.limit(1);
					if (!existingRule[0]) {
						throw new Error("Rule not found");
					}
					if (!(await isClubManager(existingRule[0].clubId, userId))) {
						throw new Error("Only club managers and owners can update rules");
					}
					const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
					if (parsed.data.name) updateData.name = parsed.data.name;
					if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
					if (parsed.data.content !== undefined) updateData.content = parsed.data.content;

					await db.update(clubRule).set(updateData).where(eq(clubRule.id, parsed.data.ruleId));
					result = { success: true };
					break;
				}

				case "delete_club_rule": {
					const parsed = toolArgsSchemas.delete_club_rule.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const existingRule = await db
						.select()
						.from(clubRule)
						.where(eq(clubRule.id, parsed.data.ruleId))
						.limit(1);
					if (!existingRule[0]) {
						throw new Error("Rule not found");
					}
					if (!(await isClubManager(existingRule[0].clubId, userId))) {
						throw new Error("Only club managers and owners can delete rules");
					}
					await db.delete(clubRule).where(eq(clubRule.id, parsed.data.ruleId));
					result = { success: true };
					break;
				}

				case "get_club_posts": {
					const parsed = toolArgsSchemas.get_club_posts.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const posts = await db
						.select()
						.from(post)
						.where(eq(post.clubId, parsed.data.clubId))
						.orderBy(desc(post.createdAt));
					result = posts;
					break;
				}

				case "get_club_post": {
					const parsed = toolArgsSchemas.get_club_post.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const postData = await db.select().from(post).where(eq(post.id, parsed.data.postId)).limit(1);
					result = postData[0] || null;
					break;
				}

				case "create_club_post": {
					const parsed = toolArgsSchemas.create_club_post.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					if (!(await isClubManager(parsed.data.clubId, userId))) {
						throw new Error("Only club managers and owners can create posts");
					}
					const now = new Date().toISOString();
					const newPost = await db
						.insert(post)
						.values({
							id: crypto.randomUUID(),
							clubId: parsed.data.clubId,
							title: parsed.data.title,
							content: parsed.data.content,
							images: parsed.data.images || null,
							isPublic: parsed.data.isPublic || false,
							createdAt: now,
							updatedAt: now,
						})
						.returning();
					result = newPost[0];
					break;
				}

				case "update_club_post": {
					const parsed = toolArgsSchemas.update_club_post.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const existingPost = await db.select().from(post).where(eq(post.id, parsed.data.postId)).limit(1);
					if (!existingPost[0]) {
						throw new Error("Post not found");
					}
					if (!(await isClubManager(existingPost[0].clubId, userId))) {
						throw new Error("Only club managers and owners can update posts");
					}
					const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
					if (parsed.data.title) updateData.title = parsed.data.title;
					if (parsed.data.content !== undefined) updateData.content = parsed.data.content;
					if (parsed.data.images !== undefined) updateData.images = parsed.data.images;
					if (parsed.data.isPublic !== undefined) updateData.isPublic = parsed.data.isPublic;

					await db.update(post).set(updateData).where(eq(post.id, parsed.data.postId));
					result = { success: true };
					break;
				}

				case "add_club_member": {
					const parsed = toolArgsSchemas.add_club_member.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					if (!(await isClubManager(parsed.data.clubId, userId))) {
						throw new Error("Only club managers and owners can add members");
					}
					const now = new Date().toISOString();
					const newMembership = await db
						.insert(clubMembership)
						.values({
							id: crypto.randomUUID(),
							userId: parsed.data.userId,
							clubId: parsed.data.clubId,
							role: (parsed.data.role as "USER" | "MANAGER") || "USER",
							createdAt: now,
							updatedAt: now,
						})
						.returning();
					result = newMembership[0];
					break;
				}

				case "remove_club_member": {
					const parsed = toolArgsSchemas.remove_club_member.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const membership = await getUserMembership(parsed.data.clubId, parsed.data.userId);
					if (!membership) {
						throw new Error("Membership not found");
					}
					if (membership.role === "CLUB_OWNER") {
						throw new Error("Cannot remove club owner");
					}
					const isManager = await isClubManager(parsed.data.clubId, userId);
					if (!isManager && userId !== parsed.data.userId) {
						throw new Error("Only managers can remove other members");
					}
					await db
						.delete(clubMembership)
						.where(
							and(
								eq(clubMembership.clubId, parsed.data.clubId),
								eq(clubMembership.userId, parsed.data.userId),
							),
						);
					result = { success: true };
					break;
				}

				case "extend_membership": {
					const parsed = toolArgsSchemas.extend_membership.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					if (!(await isClubManager(parsed.data.clubId, userId))) {
						throw new Error("Only club managers and owners can extend memberships");
					}
					await db
						.update(clubMembership)
						.set({ endDate: parsed.data.endDate, updatedAt: new Date().toISOString() })
						.where(
							and(
								eq(clubMembership.clubId, parsed.data.clubId),
								eq(clubMembership.userId, parsed.data.userId),
							),
						);
					result = { success: true };
					break;
				}

				case "leave_club": {
					const parsed = toolArgsSchemas.leave_club.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const membership = await getUserMembership(parsed.data.clubId, userId);
					if (!membership) {
						throw new Error("Not a member of this club");
					}
					if (membership.role === "CLUB_OWNER") {
						throw new Error("Club owner cannot leave. Transfer ownership first.");
					}
					await db
						.delete(clubMembership)
						.where(and(eq(clubMembership.clubId, parsed.data.clubId), eq(clubMembership.userId, userId)));
					result = { success: true };
					break;
				}

				case "list_events": {
					const parsed = toolArgsSchemas.list_events.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}

					let query = db.select().from(event);
					if (parsed.data.clubId) {
						query = query.where(eq(event.clubId, parsed.data.clubId)) as typeof query;
					}

					const events = await query.orderBy(desc(event.dateStart));
					result = events;
					break;
				}

				case "get_event": {
					const parsed = toolArgsSchemas.get_event.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const eventData = await db.select().from(event).where(eq(event.id, parsed.data.eventId)).limit(1);
					result = eventData[0] || null;
					break;
				}

				case "list_event_registrations": {
					const parsed = toolArgsSchemas.list_event_registrations.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const registrations = await db
						.select({
							id: eventRegistration.id,
							eventId: eventRegistration.eventId,
							createdById: eventRegistration.createdById,
							type: eventRegistration.type,
							paymentMethod: eventRegistration.paymentMethod,
							attended: eventRegistration.attended,
							createdAt: eventRegistration.createdAt,
							userName: user.name,
						})
						.from(eventRegistration)
						.innerJoin(user, eq(eventRegistration.createdById, user.id))
						.where(eq(eventRegistration.eventId, parsed.data.eventId));
					result = registrations;
					break;
				}

				case "register_for_event": {
					const parsed = toolArgsSchemas.register_for_event.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}

					const eventData = await db.select().from(event).where(eq(event.id, parsed.data.eventId)).limit(1);

					if (!eventData[0]) {
						throw new Error("Event not found");
					}

					const existing = await db
						.select()
						.from(eventRegistration)
						.where(
							and(
								eq(eventRegistration.eventId, parsed.data.eventId),
								eq(eventRegistration.createdById, userId),
							),
						)
						.limit(1);

					if (existing[0]) {
						throw new Error("Already registered for this event");
					}

					const newRegistration = await db
						.insert(eventRegistration)
						.values({
							id: crypto.randomUUID(),
							eventId: parsed.data.eventId,
							createdById: userId,
							type: "solo",
							paymentMethod: "cash",
							attended: false,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						})
						.returning();

					result = newRegistration[0] || null;
					break;
				}

				case "create_event": {
					const parsed = toolArgsSchemas.create_event.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					if (!(await isClubManager(parsed.data.clubId, userId))) {
						throw new Error("Only club managers and owners can create events");
					}
					const now = new Date().toISOString();
					const newEvent = await db
						.insert(event)
						.values({
							id: crypto.randomUUID(),
							clubId: parsed.data.clubId,
							name: parsed.data.name,
							description: parsed.data.description,
							dateStart: parsed.data.dateStart,
							dateEnd: parsed.data.dateEnd,
							dateRegistrationsOpen: parsed.data.dateRegistrationsOpen,
							dateRegistrationsClose: parsed.data.dateRegistrationsClose,
							location: parsed.data.location,
							costPerPerson: parsed.data.costPerPerson || 0,
							isPrivate: parsed.data.isPrivate || false,
							allowFreelancers: parsed.data.allowFreelancers || false,
							hasBreakfast: parsed.data.hasBreakfast || false,
							hasLunch: parsed.data.hasLunch || false,
							hasDinner: parsed.data.hasDinner || false,
							hasSnacks: parsed.data.hasSnacks || false,
							hasDrinks: parsed.data.hasDrinks || false,
							hasPrizes: parsed.data.hasPrizes || false,
							createdAt: now,
							updatedAt: now,
						})
						.returning();
					result = newEvent[0];
					break;
				}

				case "update_event": {
					const parsed = toolArgsSchemas.update_event.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const existingEvent = await db
						.select()
						.from(event)
						.where(eq(event.id, parsed.data.eventId))
						.limit(1);
					if (!existingEvent[0]) {
						throw new Error("Event not found");
					}
					if (!(await isClubManager(existingEvent[0].clubId, userId))) {
						throw new Error("Only club managers and owners can update events");
					}
					const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
					if (parsed.data.name) updateData.name = parsed.data.name;
					if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
					if (parsed.data.dateStart) updateData.dateStart = parsed.data.dateStart;
					if (parsed.data.dateEnd) updateData.dateEnd = parsed.data.dateEnd;
					if (parsed.data.dateRegistrationsOpen)
						updateData.dateRegistrationsOpen = parsed.data.dateRegistrationsOpen;
					if (parsed.data.dateRegistrationsClose)
						updateData.dateRegistrationsClose = parsed.data.dateRegistrationsClose;
					if (parsed.data.location) updateData.location = parsed.data.location;
					if (parsed.data.costPerPerson !== undefined) updateData.costPerPerson = parsed.data.costPerPerson;
					if (parsed.data.isPrivate !== undefined) updateData.isPrivate = parsed.data.isPrivate;

					await db.update(event).set(updateData).where(eq(event.id, parsed.data.eventId));
					result = { success: true };
					break;
				}

				case "get_event_rules": {
					const parsed = toolArgsSchemas.get_event_rules.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const rules = await db.select().from(clubRule).where(eq(clubRule.eventId, parsed.data.eventId));
					result = rules;
					break;
				}

				case "get_registrations_count": {
					const parsed = toolArgsSchemas.get_registrations_count.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const [countResult] = await db
						.select({ count: count() })
						.from(eventRegistration)
						.where(eq(eventRegistration.eventId, parsed.data.eventId));
					result = { count: countResult?.count || 0 };
					break;
				}

				case "update_registration_attendance": {
					const parsed = toolArgsSchemas.update_registration_attendance.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const registration = await db
						.select()
						.from(eventRegistration)
						.where(eq(eventRegistration.id, parsed.data.registrationId))
						.limit(1);
					if (!registration[0]) {
						throw new Error("Registration not found");
					}
					const eventData = await db
						.select()
						.from(event)
						.where(eq(event.id, registration[0].eventId))
						.limit(1);
					if (!eventData[0]) {
						throw new Error("Event not found");
					}
					if (!(await isClubManager(eventData[0].clubId, userId))) {
						throw new Error("Only club managers and owners can update attendance");
					}
					await db
						.update(eventRegistration)
						.set({ attended: parsed.data.attended, updatedAt: new Date().toISOString() })
						.where(eq(eventRegistration.id, parsed.data.registrationId));
					result = { success: true };
					break;
				}

				case "create_review": {
					const parsed = toolArgsSchemas.create_review.safeParse(args);
					if (!parsed.success) {
						throw new Error(`Invalid arguments: ${parsed.error.message}`);
					}
					const now = new Date().toISOString();
					const newReview = await db
						.insert(review)
						.values({
							id: crypto.randomUUID(),
							type: parsed.data.type,
							rating: parsed.data.rating,
							content: parsed.data.content,
							authorId: userId,
							userId: parsed.data.userId || null,
							clubId: parsed.data.clubId || null,
							eventId: parsed.data.eventId || null,
							createdAt: now,
							updatedAt: now,
						})
						.returning();
					result = newReview[0];
					break;
				}

				default:
					throw new Error(`Unknown tool: ${name}`);
			}

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({ error: message }),
					},
				],
				isError: true,
			};
		}
	});

	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
	});

	await server.connect(transport);

	return transport.handleRequest(request);
}
