import { relations } from "drizzle-orm/relations";
import {
	account,
	achievement,
	achievementToUser,
	alliance,
	club,
	clubAlliance,
	clubAuditLog,
	clubInvite,
	clubMembership,
	clubPurchase,
	clubRule,
	country,
	event,
	eventRegistration,
	passkey,
	post,
	review,
	reviewEditHistory,
	session,
	twoFactor,
	user,
} from "./schema";

export const clubRelations = relations(club, ({ one, many }) => ({
	country: one(country, {
		fields: [club.countryId],
		references: [country.id],
	}),
	clubPurchases: many(clubPurchase),
	clubRules: many(clubRule),
	clubMemberships: many(clubMembership),
	clubInvites: many(clubInvite),
	clubAuditLogs: many(clubAuditLog),
	events: many(event),
	reviews: many(review),
	posts: many(post),
	clubAlliances: many(clubAlliance),
}));

export const countryRelations = relations(country, ({ many }) => ({
	clubs: many(club),
	alliances: many(alliance),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
}));

export const userRelations = relations(user, ({ many }) => ({
	accounts: many(account),
	passkeys: many(passkey),
	twoFactors: many(twoFactor),
	sessions: many(session),
	clubMemberships: many(clubMembership),
	clubInvites: many(clubInvite),
	clubAuditLogs: many(clubAuditLog),
	eventRegistrations: many(eventRegistration),
	reviews_authorId: many(review, {
		relationName: "review_authorId_user_id",
	}),
	reviews_userId: many(review, {
		relationName: "review_userId_user_id",
	}),
	achievementToUsers: many(achievementToUser),
}));

export const passkeyRelations = relations(passkey, ({ one }) => ({
	user: one(user, {
		fields: [passkey.userId],
		references: [user.id],
	}),
}));

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
	user: one(user, {
		fields: [twoFactor.userId],
		references: [user.id],
	}),
}));

export const clubPurchaseRelations = relations(clubPurchase, ({ one }) => ({
	club: one(club, {
		fields: [clubPurchase.clubId],
		references: [club.id],
	}),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const clubRuleRelations = relations(clubRule, ({ one }) => ({
	club: one(club, {
		fields: [clubRule.clubId],
		references: [club.id],
	}),
	event: one(event, {
		fields: [clubRule.eventId],
		references: [event.id],
	}),
}));

export const eventRelations = relations(event, ({ one, many }) => ({
	clubRules: many(clubRule),
	club: one(club, {
		fields: [event.clubId],
		references: [club.id],
	}),
	eventRegistrations: many(eventRegistration),
	reviews: many(review),
}));

export const clubMembershipRelations = relations(clubMembership, ({ one }) => ({
	user: one(user, {
		fields: [clubMembership.userId],
		references: [user.id],
	}),
	club: one(club, {
		fields: [clubMembership.clubId],
		references: [club.id],
	}),
}));

export const clubInviteRelations = relations(clubInvite, ({ one }) => ({
	club: one(club, {
		fields: [clubInvite.clubId],
		references: [club.id],
	}),
	user: one(user, {
		fields: [clubInvite.userId],
		references: [user.id],
	}),
}));

export const clubAuditLogRelations = relations(clubAuditLog, ({ one }) => ({
	user: one(user, {
		fields: [clubAuditLog.userId],
		references: [user.id],
	}),
	club: one(club, {
		fields: [clubAuditLog.clubId],
		references: [club.id],
	}),
}));

export const eventRegistrationRelations = relations(eventRegistration, ({ one }) => ({
	event: one(event, {
		fields: [eventRegistration.eventId],
		references: [event.id],
	}),
	user: one(user, {
		fields: [eventRegistration.createdById],
		references: [user.id],
	}),
}));

export const reviewRelations = relations(review, ({ one, many }) => ({
	user_authorId: one(user, {
		fields: [review.authorId],
		references: [user.id],
		relationName: "review_authorId_user_id",
	}),
	user_userId: one(user, {
		fields: [review.userId],
		references: [user.id],
		relationName: "review_userId_user_id",
	}),
	club: one(club, {
		fields: [review.clubId],
		references: [club.id],
	}),
	event: one(event, {
		fields: [review.eventId],
		references: [event.id],
	}),
	editHistory: many(reviewEditHistory),
}));

export const reviewEditHistoryRelations = relations(reviewEditHistory, ({ one }) => ({
	review: one(review, {
		fields: [reviewEditHistory.reviewId],
		references: [review.id],
	}),
	editor: one(user, {
		fields: [reviewEditHistory.editedBy],
		references: [user.id],
	}),
}));

export const postRelations = relations(post, ({ one }) => ({
	club: one(club, {
		fields: [post.clubId],
		references: [club.id],
	}),
}));

export const achievementToUserRelations = relations(achievementToUser, ({ one }) => ({
	achievement: one(achievement, {
		fields: [achievementToUser.a],
		references: [achievement.id],
	}),
	user: one(user, {
		fields: [achievementToUser.b],
		references: [user.id],
	}),
}));

export const achievementRelations = relations(achievement, ({ many }) => ({
	achievementToUsers: many(achievementToUser),
}));

export const allianceRelations = relations(alliance, ({ one, many }) => ({
	country: one(country, {
		fields: [alliance.countryId],
		references: [country.id],
	}),
	clubAlliances: many(clubAlliance),
}));

export const clubAllianceRelations = relations(clubAlliance, ({ one }) => ({
	club: one(club, {
		fields: [clubAlliance.clubId],
		references: [club.id],
	}),
	alliance: one(alliance, {
		fields: [clubAlliance.allianceId],
		references: [alliance.id],
	}),
}));
