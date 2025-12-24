import { relations } from "drizzle-orm/relations";
import {
	account,
	achievement,
	achievementToUser,
	club,
	clubAuditLog,
	clubInvite,
	clubMembership,
	clubPurchase,
	clubRule,
	country,
	event,
	eventInvite,
	eventRegistration,
	eventRegistrationToUser,
	passkey,
	post,
	review,
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
}));

export const countryRelations = relations(country, ({ many }) => ({
	clubs: many(club),
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
	eventRegistrationToUsers: many(eventRegistrationToUser),
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
	eventInvites: many(eventInvite),
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

export const eventRegistrationRelations = relations(eventRegistration, ({ one, many }) => ({
	event: one(event, {
		fields: [eventRegistration.eventId],
		references: [event.id],
	}),
	user: one(user, {
		fields: [eventRegistration.createdById],
		references: [user.id],
	}),
	eventInvites: many(eventInvite),
	eventRegistrationToUsers: many(eventRegistrationToUser),
}));

export const eventInviteRelations = relations(eventInvite, ({ one }) => ({
	event: one(event, {
		fields: [eventInvite.eventId],
		references: [event.id],
	}),
	eventRegistration: one(eventRegistration, {
		fields: [eventInvite.eventRegistrationId],
		references: [eventRegistration.id],
	}),
}));

export const reviewRelations = relations(review, ({ one }) => ({
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

export const eventRegistrationToUserRelations = relations(eventRegistrationToUser, ({ one }) => ({
	eventRegistration: one(eventRegistration, {
		fields: [eventRegistrationToUser.a],
		references: [eventRegistration.id],
	}),
	user: one(user, {
		fields: [eventRegistrationToUser.b],
		references: [user.id],
	}),
}));
