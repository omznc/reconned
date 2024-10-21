"use client";

import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

const variants = {
	hidden: { x: -500, y: 0 },
	enter: { x: 0, y: 0 },
	exit: { x: 500, y: 0 },
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const path = usePathname();

	return (
		<Card className="w-full border-0 md:border shadow-none md:max-w-sm overflow-hidden h-fit">
			<AnimatePresence initial={false} mode="wait">
				<motion.div
					key={path}
					variants={variants}
					initial="hidden"
					animate="enter"
					exit="exit"
					transition={{ type: "linear" }}
				>
					{children}
				</motion.div>
			</AnimatePresence>
		</Card>
	);
}
