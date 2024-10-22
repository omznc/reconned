"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useIsAuthenticated } from "@/lib/auth-client";
import { motion, AnimatePresence } from "framer-motion";
import { House, Loader2 } from "lucide-react";
import Link from "next/link";
import { redirect, usePathname } from "next/navigation";

const variants = {
	hidden: { x: -700, y: 0, filter: "blur(5px)" },
	enter: { x: 0, y: 0, filter: "blur(0px)" },
	exit: { x: 700, y: 0, filter: "blur(5px)" },
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const path = usePathname();
	const { user, loading } = useIsAuthenticated();

	if (!loading && user) {
		redirect("/");
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-screen w-full">
				<Loader2 className="w-12 h-12 animate-spin" />
			</div>
		);
	}

	return (
		<Card className="w-full border-0 mx-auto md:border min-h-[550px] shadow-none md:max-w-sm overflow-hidden h-fit">
			<div className="w-full p-6">
				<Button variant={"outline"} className="w-full" asChild={true}>
					<Link href="/" className="flex items-center gap-2">
						<House className="w-4 h-4" />
						Početna
					</Link>
				</Button>
			</div>
			<AnimatePresence initial={false} mode="wait">
				<motion.div
					key={path}
					variants={variants}
					initial="hidden"
					animate="enter"
					exit="exit"
					transition={{ type: "tween", duration: 0.2 }}
				>
					{children}
				</motion.div>
			</AnimatePresence>
		</Card>
	);
}
