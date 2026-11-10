import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder for the auth forms while they hydrate.
 *
 * The auth pages read query state (`useQueryState` -> `useSearchParams`), which cannot run
 * during static prerendering, so each form is wrapped in a `<Suspense>` boundary. Without a
 * fallback that boundary renders `null`, leaving the surrounding card visibly empty on first
 * paint. This keeps the card's shape stable until the real form takes over.
 */
export function AuthFormSkeleton() {
	return (
		<div className="w-full flex flex-col gap-4 p-6" aria-hidden="true">
			<Skeleton className="h-7 w-1/2" />
			<Skeleton className="h-4 w-3/4" />
			<Skeleton className="h-10 w-full mt-2" />
			<Skeleton className="h-10 w-full" />
			<Skeleton className="h-10 w-full mt-2" />
		</div>
	);
}
