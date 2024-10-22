"use client";

import { useIsAuthenticated } from "@auth/client";

import Link from "next/link";

export default function Home() {
	const { data: session } = useIsAuthenticated();

	return (
		<div className="flex flex-col max-w-lg">
			{session ? <button type="button">Logout</button> : <Link href="/login">Sign In</Link>}
			{session ? `Hello ${session.user.name}` : "Please sign in"}
		</div>
	);
}
