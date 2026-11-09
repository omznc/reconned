type Fields = Record<string, unknown>;

type Logger = {
	debug: (message: string, fields?: Fields) => void;
	info: (message: string, fields?: Fields) => void;
	warn: (message: string, fields?: Fields) => void;
	error: (message: string, fields?: Fields) => void;
};

// shortcut: console only, replaces next-axiom; ship to Axiom or PostHog logs when server-side log search is needed
const logger: Logger = {
	debug: (message, fields) => console.debug(message, fields),
	info: (message, fields) => console.info(message, fields),
	warn: (message, fields) => console.warn(message, fields),
	error: (message, fields) => console.error(message, fields),
};

/** Drop-in for `useLogger()` from `next-axiom`. */
export function useLogger(_defaults?: Fields): Logger {
	return logger;
}
