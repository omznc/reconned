"use client";

import { Button } from "@/components/ui/button";
import { authClient, useIsAuthenticated } from "@auth/client";

import Link from "next/link";

export default function Home() {
	const { data: session } = useIsAuthenticated();

	return (
		<div className="flex flex-col max-w-lg">
			{session ? (
				<>
					<Button
						type="button"
						onClick={() => {
							authClient.signOut();
						}}
					>
						Logout
					</Button>
					Hello {session.user.name}
				</>
			) : (
				<>
					<Button type="button">
						<Link href="/login">Sign In</Link>
					</Button>
					Please sign in
				</>
			)}
		</div>
	);
}
