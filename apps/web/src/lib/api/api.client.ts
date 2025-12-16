import createClient from "openapi-fetch";
import { env } from "../env";
import type { paths } from "./api-types";

const apiClient = createClient<paths>({
	baseUrl: env.NEXT_PUBLIC_BACKEND_URL,
	credentials: "include",
});

export default apiClient;
