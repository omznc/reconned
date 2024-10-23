"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function Template({ children }: { children: ReactNode }) {
	return (
		<motion.div
			initial={{ opacity: 0, translateY: 5 }}
			animate={{ opacity: 1, translateY: 0 }}
			transition={{ type: "tween", duration: 0.2 }}
		>
			{children}
		</motion.div>
	);
}
