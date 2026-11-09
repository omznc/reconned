import { useEffect, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

/** A text box value that follows the URL value, and commits to the URL after a pause. */
export function useDebouncedSearch(value: string, onCommit: (value: string) => void) {
	const [text, setText] = useState(value);
	useEffect(() => {
		setText(value);
	}, [value]);
	const commit = useDebouncedCallback(onCommit, 300);
	return {
		value: text,
		onChange: (next: string) => {
			setText(next);
			commit(next);
		},
	};
}
