"use client";

import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

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

	return (
		<Card className="w-full border-0 md:border min-h-[500px] shadow-none md:max-w-sm overflow-hidden h-fit">
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
