type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue | undefined };

/** The input type with each `unknown` replaced by a JSON value, so a server function accepts it as serializable. */
type Json<T> = unknown extends T
	? JsonValue
	: T extends Array<infer Item>
		? Array<Json<Item>>
		: T extends object
			? { [Key in keyof T]: Json<T[Key]> }
			: T;

/** Marks API data as serializable: it came from `JSON.parse`, but the generated API types say `unknown`. */
export function asJson<T>(value: T): Json<T> {
	return value as Json<T>;
}
