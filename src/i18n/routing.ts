import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
	// A list of all locales that are supported
	locales: ["en", "bs"],

	// Used when no locale matches
	defaultLocale: "en",
	// pathnames: {
	// 	// Public routes
	// 	"/": "/",
	// 	"/about": {
	// 		bs: "/o-nama",
	// 	},
	// 	"/clubs": {
	// 		bs: "/klubovi",
	// 	},
	// 	"/clubs/[id]": {
	// 		bs: "/klubovi/[id]",
	// 	},
	// 	"/events": {
	// 		bs: "/dogadjaji",
	// 	},
	// 	"/events/[id]": {
	// 		bs: "/dogadjaji/[id]",
	// 	},
	// 	"/map": {
	// 		bs: "/karta",
	// 	},
	// 	"/search": {
	// 		bs: "/pretraga",
	// 	},
	// 	"/sponsors": {
	// 		bs: "/sponzori",
	// 	},
	// 	"/users": {
	// 		bs: "/korisnici",
	// 	},
	// 	"/users/[id]": {
	// 		bs: "/korisnici/[id]",
	// 	},

	// 	// Auth routes
	// 	"/login": {
	// 		bs: "/prijava",
	// 	},
	// 	"/register": {
	// 		bs: "/registracija",
	// 	},
	// 	"/reset-password": {
	// 		bs: "/reset-sifre",
	// 	},
	// 	"/two-factor": {
	// 		bs: "/dvofaktorska",
	// 	},
	// 	logout: {
	// 		bs: "/odjava",
	// 	},

	// 	// DASHBOARD ROUTES

	// 	// Club-specific dashboard routes
	// 	"/dashboard/add-club": {
	// 		bs: "/dashboard/dodaj-klub",
	// 	},
	// 	"/dashboard/[clubId]/club": {
	// 		bs: "/dashboard/[clubId]/klub",
	// 	},
	// 	"/dashboard/[clubId]/club/information": {
	// 		bs: "/dashboard/[clubId]/klub/informacije",
	// 	},
	// 	"/dashboard/[clubId]/club/spending": {
	// 		bs: "/dashboard/[clubId]/klub/troskovi",
	// 	},
	// 	"/dashboard/[clubId]/club/stats": {
	// 		bs: "/dashboard/[clubId]/klub/statistike",
	// 	},
	// 	"/dashboard/[clubId]/club/posts": {
	// 		bs: "/dashboard/[clubId]/klub/objave",
	// 	},

	// 	// Club events
	// 	"/dashboard/[clubId]/events": {
	// 		bs: "/dashboard/[clubId]/dogadjaji",
	// 	},
	// 	"/dashboard/[clubId]/events/[id]": {
	// 		bs: "/dashboard/[clubId]/dogadjaji/[id]",
	// 	},
	// 	"/dashboard/[clubId]/events/[id]/attendance": {
	// 		bs: "/dashboard/[clubId]/dogadjaji/[id]/prisustvo",
	// 	},
	// 	"/dashboard/[clubId]/events/calendar": {
	// 		bs: "/dashboard/[clubId]/dogadjaji/kalendar",
	// 	},
	// 	"/dashboard/[clubId]/events/create": {
	// 		bs: "/dashboard/[clubId]/dogadjaji/novi",
	// 	},
	// 	"/dashboard/[clubId]/events/rules": {
	// 		bs: "/dashboard/[clubId]/dogadjaji/pravila",
	// 	},

	// 	// Club members
	// 	"/dashboard/[clubId]/members": {
	// 		bs: "/dashboard/[clubId]/clanovi",
	// 	},
	// 	"/dashboard/[clubId]/members/invitations": {
	// 		bs: "/dashboard/[clubId]/clanovi/pozivnice",
	// 	},
	// 	"/dashboard/[clubId]/members/managers": {
	// 		bs: "/dashboard/[clubId]/clanovi/menadzeri",
	// 	},

	// 	// Dashboard routes
	// 	"/dashboard": "/dashboard",
	// 	"/dashboard/help": {
	// 		bs: "/dashboard/pomoc",
	// 	},
	// 	"/dashboard/admin/clubs": {
	// 		bs: "/dashboard/admin/klubovi",
	// 	},
	// 	"/dashboard/admin/users": {
	// 		bs: "/dashboard/admin/korisnici",
	// 	},
	// 	"/dashboard/admin/emails": {
	// 		bs: "/dashboard/admin/emailovi",
	// 	},

	// 	// User-specific dashboard routes
	// 	"/dashboard/user": {
	// 		bs: "/dashboard/korisnik",
	// 	},
	// 	"/dashboard/user/settings": {
	// 		bs: "/dashboard/korisnik/postavke",
	// 	},
	// 	"/dashboard/user/security": {
	// 		bs: "/dashboard/korisnik/sigurnost",
	// 	},
	// 	"/dashboard/user/invites": {
	// 		bs: "/dashboard/korisnik/pozivnice",
	// 	},

	// 	// Event-specific dashboard routes
	// 	"/dashboard/events": {
	// 		bs: "/dashboard/dogadjaji",
	// 	},
	// },
});
