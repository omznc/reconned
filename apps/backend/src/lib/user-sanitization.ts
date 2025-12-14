function sanitizeUser<
	T extends { isPrivateEmail?: boolean; isPrivatePhone?: boolean; email?: string | null; phone?: string | null },
>(userData: T): Omit<T, "email" | "phone"> & { email?: string | null; phone?: string | null } {
	const { email: _email, phone: _phone, ...rest } = userData;
	return {
		...rest,
		...(userData.isPrivateEmail ? {} : { email: _email }),
		...(userData.isPrivatePhone ? {} : { phone: _phone }),
	} as Omit<T, "email" | "phone"> & { email?: string | null; phone?: string | null };
}

function isUserObject(value: unknown): value is {
	id?: string;
	email?: string | null;
	phone?: string | null;
	isPrivateEmail?: boolean;
	isPrivatePhone?: boolean;
} {
	return (
		typeof value === "object" &&
		value !== null &&
		("id" in value || "email" in value || "phone" in value) &&
		("isPrivateEmail" in value || "isPrivatePhone" in value)
	);
}

function sanitizeUserInObject(obj: unknown, requestingUserId?: string, isAdmin?: boolean): unknown {
	if (isUserObject(obj)) {
		if (requestingUserId && (obj.id === requestingUserId || isAdmin)) {
			return obj;
		}
		return sanitizeUser(obj);
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => sanitizeUserInObject(item, requestingUserId, isAdmin));
	}

	if (typeof obj === "object" && obj !== null) {
		const objRecord = obj as Record<string, unknown>;

		if ("id" in objRecord && "isPrivateEmail" in objRecord) {
			const userObj = objRecord as {
				id?: string;
				isPrivateEmail?: boolean;
				isPrivatePhone?: boolean;
				email?: string | null;
				phone?: string | null;
			};
			if (requestingUserId && (userObj.id === requestingUserId || isAdmin)) {
				return obj;
			}
			return {
				...objRecord,
				...sanitizeUser(userObj),
			};
		}

		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(objRecord)) {
			if (key === "users" && Array.isArray(value)) {
				result[key] = value.map((item) => sanitizeUserInObject(item, requestingUserId, isAdmin));
			} else if (isUserObject(value)) {
				result[key] = sanitizeUserInObject(value, requestingUserId, isAdmin);
			} else if (typeof value === "object" && value !== null) {
				result[key] = sanitizeUserInObject(value, requestingUserId, isAdmin);
			} else {
				result[key] = value;
			}
		}
		return result;
	}

	return obj;
}

export { sanitizeUserInObject };
