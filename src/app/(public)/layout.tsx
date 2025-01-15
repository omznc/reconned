import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { isAuthenticated } from "@/lib/auth";
import type { ReactNode } from "react";

export default async function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	const user = await isAuthenticated();
	return (
		<>
			<div className="w-full min-h-screen flex flex-col items-center">
				<Header user={user} />
				<div className="flex-grow size-full flex flex-col items-center">
					<div className="absolute -z-10 inset-0 bg-gradient-to-b from-red-600/30 to-transparent h-[70dvh]" />

					{children}
				</div>
			</div>
			<Footer />
		</>
	);
}
