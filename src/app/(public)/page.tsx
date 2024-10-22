"use client";

import { Button } from "@/components/ui/button";
import { authClient, useIsAuthenticated } from "@auth/client";

import Link from "next/link";

export default function Home() {
	const { data: session } = useIsAuthenticated();

	return <div className="flex flex-col max-w-lg">Ide gas</div>;
}
