import "server-only";

import { headers } from "next/headers";
import createClient from "openapi-fetch";
import { env } from "../env";
import type { paths } from "./api-types";

// Similar to api.client.ts but for server components (gotta include headers)
const apiServer = createClient<paths>({
	baseUrl: env.NEXT_PUBLIC_BACKEND_URL,
	credentials: "include",
	fetch: async (request) => {
		const headersList = await headers();
		return fetch(request, {
			headers: headersList,
		});
	},
});

export default apiServer;
