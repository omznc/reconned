export class ActionError extends Error {}

if (!globalThis.ActionError) {
	globalThis.ActionError = ActionError;
}
