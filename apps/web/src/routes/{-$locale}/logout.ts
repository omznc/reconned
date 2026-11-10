import { createFileRoute } from "@tanstack/react-router";
import { getPathname } from "@/i18n/navigation";
import { getRequestLocale } from "@/i18n/request-locale";
import { env } from "@/lib/env";

export const Route = createFileRoute("/{-$locale}/logout")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const locale = getRequestLocale();
				const signOut = await fetch(new URL("/api/auth/sign-out", env.NEXT_PUBLIC_BACKEND_URL), {
					method: "POST",
					headers: {
						cookie: request.headers.get("cookie") ?? "",
						"content-type": "application/json",
						origin: env.NEXT_PUBLIC_WEB_URL,
						"x-internal-api-secret": env.INTERNAL_API_SECRET,
					},
					body: "{}",
				});
				if (!signOut.ok) {
					return new Response("Failed to sign out", { status: 500 });
				}

				// Pass the backend's Set-Cookie headers on, or the browser keeps its session cookie.
				const headers = new Headers({ location: getPathname({ href: "/login", locale }) });
				for (const cookie of signOut.headers.getSetCookie()) {
					headers.append("set-cookie", cookie);
				}
				return new Response(null, { status: 302, headers });
			},
		},
	},
});
