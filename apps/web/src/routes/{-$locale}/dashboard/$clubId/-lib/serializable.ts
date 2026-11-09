type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Maps `unknown` (which the server function type check rejects) to `Json`. */
export type Serializable<T> = unknown extends T
	? Json
	: T extends readonly (infer U)[]
		? Serializable<U>[]
		: T extends object
			? { [K in keyof T]: Serializable<T[K]> }
			: T;

/** The backend returns JSON, so the value is serializable at runtime. Only the type changes. */
export function serializable<T>(value: T): Serializable<T> {
	return value as Serializable<T>;
}
