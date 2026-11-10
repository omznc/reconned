import { ClientOnly } from "@tanstack/react-router";
import { type ComponentType, lazy, type ReactNode, Suspense } from "react";

/**
 * Replacement for `next/dynamic(() => import("./x"), { ssr: false })`.
 * The module loads in the browser only; the server renders `fallback`.
 */
export function lazyClientOnly<TProps extends object>(
	load: () => Promise<{ default: ComponentType<TProps> }>,
	fallback: ReactNode = null,
) {
	const Lazy = lazy(load);

	return function ClientOnlyComponent(props: TProps) {
		return (
			<ClientOnly fallback={fallback}>
				<Suspense fallback={fallback}>
					<Lazy {...props} />
				</Suspense>
			</ClientOnly>
		);
	};
}

export { ClientOnly };
