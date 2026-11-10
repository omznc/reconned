import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

/** A text box value that follows the URL value, and commits to the URL after a pause. */
export function useDebouncedSearch(value: string, onCommit: (value: string) => void) {
	const [text, setText] = useState(value);
	// Values this box committed that the URL may not have reported back yet, oldest first.
	const inFlight = useRef<string[]>([]);
	const commit = useDebouncedCallback((next: string) => {
		inFlight.current.push(next);
		onCommit(next);
	}, 300);

	useEffect(() => {
		const index = inFlight.current.indexOf(value);
		if (index !== -1) {
			// Our own commit coming back, possibly an older one: do not overwrite newer typing.
			// The latest one means the URL has caught up.
			inFlight.current = index === inFlight.current.length - 1 ? [] : inFlight.current;
			return;
		}
		inFlight.current = [];
		// Typing waits to commit: the URL change is older than the text.
		if (!commit.isPending()) {
			setText(value);
		}
	}, [value, commit]);

	return {
		value: text,
		onChange: (next: string) => {
			setText(next);
			commit(next);
		},
	};
}
