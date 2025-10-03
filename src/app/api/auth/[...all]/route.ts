import { toNextJsHandler } from "better-auth/next-js";
import { withAxiom } from "next-axiom";
import { auth } from "@/lib/auth"; // path to your auth file

const { POST: POSTHandler, GET: GETHandler } = toNextJsHandler(auth);

// biome-ignore lint/suspicious/noExplicitAny: TODO: Fix once next-axiom sorts their stuff out
export const POST = withAxiom(POSTHandler) as any;
// biome-ignore lint/suspicious/noExplicitAny: TODO: Fix once next-axiom sorts their stuff out
export const GET = withAxiom(GETHandler) as any;
