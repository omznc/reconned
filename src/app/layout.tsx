import { env } from "@/lib/env";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
	metadataBase: env.NEXT_PUBLIC_BETTER_AUTH_URL ? new URL(env.NEXT_PUBLIC_BETTER_AUTH_URL) : undefined,
};

// is required, even if it's just passing children through.
export default function RootLayout({ children }: { children: ReactNode }) {
	return children;
}
