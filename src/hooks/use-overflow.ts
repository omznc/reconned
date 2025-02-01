import { useEffect, useRef, useState } from "react";

export function useOverflow() {
	const ref = useRef<HTMLDivElement>(null);
	const [isOverflowing, setIsOverflowing] = useState(false);

	useEffect(() => {
		if (!ref.current) {
			return;
		}

		const checkOverflow = () => {
			const element = ref.current;
			if (!element) {
				return;
			}
			// Add a small buffer (1px) to avoid rounding issues
			const isOverflown = element.scrollHeight > element.clientHeight + 1;
			setIsOverflowing(isOverflown);
		};

		const observer = new ResizeObserver(checkOverflow);
		observer.observe(ref.current);

		// Initial check
		checkOverflow();

		return () => observer.disconnect();
	}, []);

	return { ref, isOverflowing };
}
