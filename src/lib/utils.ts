import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Role } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const ROLE_TRANSLATIONS: Record<Role, string> = {
	[Role.CLUB_OWNER]: "Vlasnik kluba",
	[Role.USER]: "Korisnik",
	[Role.MANAGER]: "Menadžer",
};

const VALID_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string) => {
	return VALID_EMAIL_REGEX.test(email);
};
