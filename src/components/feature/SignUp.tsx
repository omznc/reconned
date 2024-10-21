"use client";

import { authClient } from "@/lib/auth-client"; //import the auth client
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

export default function SignUp() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");

	const { push } = useRouter();

	const signUp = async () => {
		await authClient.signUp.email(
			{
				email,
				password,
				name,
			},
			{
				onRequest: () => {
					//show loading
				},
				onSuccess: () => {
					push("/login");
				},
				onError: (ctx) => {
					alert(ctx.error.message);
				},
			},
		);
	};

	return (
		<div className="flex flex-col max-w-lg gap-2">
			<input className="border" type="name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
			<input
				className="border"
				type="password"
				placeholder="Password"
				value={password}
				onChange={(e) => setPassword(e.target.value)}
			/>
			<input
				className="border"
				type="email"
				placeholder="Email"
				value={email}
				onChange={(e) => setEmail(e.target.value)}
			/>
			<button type="button">
				<Link href="/login">Sign In</Link>
			</button>
			<button type="button" onClick={signUp}>
				Sign Up
			</button>
		</div>
	);
}
