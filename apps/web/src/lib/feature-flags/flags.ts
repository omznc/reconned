/**
 * Feature Flag Name Type
 *
 * Feature flags must follow the SCREAMING_SNAKE_CASE naming convention.
 * Examples: NEW_DASHBOARD_UI, BETA_FEATURES, EXPERIMENTAL_SEARCH
 */

/**
 * Template literal type that validates SCREAMING_SNAKE_CASE format
 * Only accepts strings that are UPPERCASE with underscores
 */
type ScreamingSnakeCase<S extends string> = S extends `${infer T}_${infer U}`
	? T extends Uppercase<T>
		? `${T}_${ScreamingSnakeCase<U>}`
		: never
	: S extends Uppercase<S>
		? S
		: never;

/**
 * Type representing valid feature flag names (SCREAMING_SNAKE_CASE format)
 * This type only accepts strings that are UPPERCASE with underscores
 */
export type FeatureFlagName = ScreamingSnakeCase<string>;

/**
 * Runtime validation helper
 * @param name - The string to validate
 * @returns true if the name matches SCREAMING_SNAKE_CASE pattern
 */
export function isValidFeatureFlagName(name: string): name is FeatureFlagName {
	return /^[A-Z][A-Z0-9_]*$/.test(name);
}

/**
 * Helper to create a type-safe feature flag name
 * Automatically converts to uppercase and replaces invalid characters
 * @param name - The feature flag name
 * @returns The name as FeatureFlagName type
 */
export function createFeatureFlagName(name: string): FeatureFlagName {
	return name.toUpperCase().replace(/[^A-Z0-9_]/g, "_") as FeatureFlagName;
}
