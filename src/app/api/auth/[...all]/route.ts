import { toNextJsHandler } from "better-auth/next-js";
import { withAxiom } from "next-axiom";
import { auth } from "@/lib/auth"; // path to your auth file

const { POST: POSTHandler, GET: GETHandler } = toNextJsHandler(auth);

export const POST = withAxiom(POSTHandler);
export const GET = withAxiom(GETHandler);
