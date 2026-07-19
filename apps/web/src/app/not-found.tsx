import { redirect } from "next/navigation";
import "./[locale]/globals.css";

// Deliberately does not read the locale: this boundary is part of every route's tree, so a
// dynamic API here opts the whole app out of static rendering. Redirecting to the unprefixed
// root lets the middleware negotiate the locale on the follow-up request instead.
export default function NotFound() {
	redirect("/");
}
