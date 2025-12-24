"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const variants = {
	hidden: { x: -700, y: 0, filter: "blur(5px)" },
	enter: { x: 0, y: 0, filter: "blur(0px)" },
	exit: { x: 700, y: 0, filter: "blur(5px)" },
};

interface AnimationWrapperProps {
	children: ReactNode;
}

export function AnimationWrapper(props: AnimationWrapperProps) {
	const path = usePathname();

	return (
		<AnimatePresence initial={false} mode="wait">
			<motion.div
				key={path}
				variants={variants}
				initial="hidden"
				animate="enter"
				exit="exit"
				transition={{ type: "tween", duration: 0.2 }}
			>
				{props.children}
			</motion.div>
		</AnimatePresence>
	);
}
