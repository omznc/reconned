import { render } from "@react-email/components";
import { apiError, Router, responseSchema } from "@reconned/router";
import { and, eq } from "drizzle-orm";
import * as z from "zod";
import { club, clubMembership, user } from "../../drizzle/schema";
import ClubClaimRequestEmail from "../../emails/club-claim-request";
import { db } from "../../lib/db";
import { getEmailMessages, interpolateMessage } from "../../lib/email-messages";
import { sendEmail } from "../../lib/mail";
import { logger } from "../../lib/posthog";

const clubsClaimRequestsRouter = new Router();

clubsClaimRequestsRouter.post(
	"/clubs/:id/claim-request",
	async ({ params, body, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const existingOwner = await db
			.select()
			.from(clubMembership)
			.where(
				and(
					eq(clubMembership.clubId, clubId),
					eq(clubMembership.role, "CLUB_OWNER"),
					eq(clubMembership.status, "ACTIVE"),
				),
			)
			.limit(1);

		if (existingOwner[0]) {
			throw apiError.validation("Club already has an owner");
		}

		const admins = await db.select({ email: user.email }).from(user).where(eq(user.role, "admin"));

		if (admins.length === 0) {
			throw apiError.internal("No admins found");
		}

		const requesterData = await db
			.select({ name: user.name, email: user.email, callsign: user.callsign })
			.from(user)
			.where(eq(user.id, context.user.id))
			.limit(1);

		if (!requesterData[0]) {
			throw apiError.notFound("Requester not found");
		}

		const adminEmails = admins.map((a) => a.email);

		try {
			const messages = getEmailMessages("en"); // Admin notifications in English
			await sendEmail({
				to: adminEmails,
				subject: interpolateMessage(messages.emails.clubClaimRequest.subject, { clubName: clubData[0].name }),
				html: await render(
					ClubClaimRequestEmail({
						clubName: clubData[0].name,
						clubLogo: clubData[0].logo,
						clubLocation: clubData[0].location,
						requesterName: requesterData[0].name,
						requesterEmail: requesterData[0].email,
						requesterCallsign: requesterData[0].callsign,
						message: body?.message || null,
						clubId,
					}),
					{
						pretty: true,
					},
				),
			});
		} catch (error) {
			logger.emit({
				severityText: "error",
				body: "Failed to send claim request email",
				attributes: {
					error: error instanceof Error ? error.message : String(error),
					club_id: clubId,
					club_name: clubData[0]?.name,
					requester_id: context.user.id,
					requester_email: requesterData[0]?.email,
					requester_name: requesterData[0]?.name,
					admin_count: adminEmails.length,
					request_id: context.requestId,
					business: {
						operation: "send_claim_request_email",
						domain: "club_management",
						email_type: "admin_notification",
					},
				},
			});
			throw apiError.internal("Failed to send email");
		}

		return response.json({
			success: true,
			message: "Claim request email sent to admins",
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Submit claim request for unclaimed club",
			description: "Submit a claim request for an unclaimed club. Sends email to admins for review.",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				message: z.string().optional(),
			}),
			mcpTool: true,
			response: {
				200: z.object({
					success: z.boolean(),
					message: z.string(),
				}),
				...responseSchema([400, 401, 403, 404, 500], z.object({ error: z.string() })),
			},
		},
	},
);

export { clubsClaimRequestsRouter };
