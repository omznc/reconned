"use client";
import { authClient } from "@/lib/auth-client"; //import the auth client
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignIn() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	const { push } = useRouter();

	const handleSignIn = async () => {
		await authClient.signIn.email(
			{
				email: email,
				password: password,
			},
			{
				onRequest: () => {
					//show loading
				},
				onSuccess: () => {
					push("/");
				},
				onError: (ctx) => {
					alert(ctx.error.message);
				},
			},
		);
	};

	return (
		<div className="flex flex-col max-w-lg">
			<input
				className="border"
				type="email"
				placeholder="Email"
				value={email}
				onChange={(e) => setEmail(e.target.value)}
			/>
			<input
				className="border"
				type="password"
				placeholder="Password"
				value={password}
				onChange={(e) => setPassword(e.target.value)}
			/>
			<button type="button">
				<Link href="/signup">Sign Up</Link>
			</button>
			<button type="button" onClick={handleSignIn}>
				Sign In
			</button>
		</div>
	);
}
