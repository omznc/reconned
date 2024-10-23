import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Role } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const ROLE_TRANSLATIONS: Record<Role, string> = {
	[Role.CLUB_OWNER]: "Vlasnik kluba",
	[Role.USER]: "Korisnik",
	[Role.ADMIN]: "Administrator",
	[Role.MANAGER]: "Menadžer",
};
