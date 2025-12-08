import "server-only";

import { Database } from "./database";
import { BaseModel } from "./prisma-abstraction";

// Individual model classes
export class User extends BaseModel {
	constructor() {
		super("users");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class Club extends BaseModel {
	constructor() {
		super("clubs");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class Event extends BaseModel {
	constructor() {
		super("events");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class EventRegistration extends BaseModel {
	constructor() {
		super("event_registrations");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class ClubMembership extends BaseModel {
	constructor() {
		super("club_memberships");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class ClubInvite extends BaseModel {
	constructor() {
		super("club_invites");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class Session extends BaseModel {
	constructor() {
		super("sessions");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class Account extends BaseModel {
	constructor() {
		super("accounts");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class Passkey extends BaseModel {
	constructor() {
		super("passkeys");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class TwoFactor extends BaseModel {
	constructor() {
		super("twofactors");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class Review extends BaseModel {
	constructor() {
		super("reviews");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class Post extends BaseModel {
	constructor() {
		super("posts");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class Achievement extends BaseModel {
	constructor() {
		super("achievements");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class ClubAuditLog extends BaseModel {
	constructor() {
		super("club_audit_logs");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class Country extends BaseModel {
	constructor() {
		super("countries");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class ClubRule extends BaseModel {
	constructor() {
		super("club_rules");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class ClubPurchase extends BaseModel {
	constructor() {
		super("club_purchases");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class EventInvite extends BaseModel {
	constructor() {
		super("event_invites");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class InstagramPageSelection extends BaseModel {
	constructor() {
		super("instagram_page_selections");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

export class Verification extends BaseModel {
	constructor() {
		super("verifications");
	}

	override async findUnique(options: any) {
		return await super.findUnique(options);
	}

	override async findMany(options: any = {}) {
		return await super.findMany(options);
	}

	override async create(data: any) {
		return await super.create(data);
	}

	override async update(where: any, data: any) {
		return await super.update(where, data);
	}

	override async delete(where: any) {
		return await super.delete(where);
	}
}

// Create instances that match Prisma's API
export const user = new User();
export const club = new Club();
export const event = new Event();
export const eventRegistration = new EventRegistration();
export const clubMembership = new ClubMembership();
export const clubInvite = new ClubInvite();
export const session = new Session();
export const account = new Account();
export const passkey = new Passkey();
export const twofactor = new TwoFactor();
export const review = new Review();
export const post = new Post();
export const achievement = new Achievement();
export const clubAuditLog = new ClubAuditLog();
export const country = new Country();
export const clubRule = new ClubRule();
export const clubPurchase = new ClubPurchase();
export const eventInvite = new EventInvite();
export const instagramPageSelection = new InstagramPageSelection();
export const verification = new Verification();

// Main prisma export that matches the original API
export const prisma = {
	user,
	club,
	event,
	eventRegistration,
	clubMembership,
	clubInvite,
	session,
	account,
	passkey,
	twofactor,
	review,
	post,
	achievement,
	clubAuditLog,
	country,
	clubRule,
	clubPurchase,
	eventInvite,
	instagramPageSelection,
	verification,
} as const;

// Transaction function
export async function $transaction<T>(callback: (trx: typeof prisma) => Promise<T>): Promise<T> {
	const db = Database.getInstance();
	return await db.transaction(async () => {
		return await callback(prisma);
	});
}
