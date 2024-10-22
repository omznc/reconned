import { authMiddleware } from "better-auth/next-js";

export default authMiddleware({
	redirectTo: "/login",
});

export const config = {
	matcher: ["/dashboard/:path*"],
};
