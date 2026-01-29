/**
 * Sanitization utilities for user-generated content
 */

/**
 * Removes zalgo text (combining diacritical marks)
 * Zalo text uses combining marks in the range U+0300–U+036F to create "glitchy" text
 */
function removeZalgoText(text: string): string {
	return text.replace(/[\u0300-\u036f]/g, "");
}

/**
 * Removes excessive whitespace from text
 * - More than 2 consecutive line breaks become 2 line breaks
 * - More than 2 consecutive spaces become 2 spaces
 * - Trims leading/trailing whitespace
 */
function removeExcessiveWhitespace(text: string): string {
	return text
		.replace(/\n{3,}/g, "\n\n")
		.replace(/ {3,}/g, "  ")
		.trim();
}

/**
 * Sanitizes review content by removing zalgo text and excessive whitespace
 *
 * @param content - The raw review content from user input
 * @returns Sanitized content safe for storage and display
 */
export function sanitizeReviewContent(content: string): string {
	const withoutZalgo = removeZalgoText(content);
	const normalizedWhitespace = removeExcessiveWhitespace(withoutZalgo);
	return normalizedWhitespace;
}
