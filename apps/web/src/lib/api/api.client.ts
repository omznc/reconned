import createClient from "openapi-fetch";
import type { paths } from "../api-types";
import { env } from "../env";

const apiClient = createClient<paths>({
	baseUrl: env.NEXT_PUBLIC_BACKEND_URL,
	credentials: "include",
});

export default apiClient;
