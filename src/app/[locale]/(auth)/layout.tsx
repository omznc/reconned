"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { House } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { ReactNode } from "react";
import background from './background-blur.webp';
import backgroundLight from './background-blur-light.webp';
import Image from "next/image";

const variants = {
	hidden: { x: -700, y: 0, filter: "blur(5px)" },
	enter: { x: 0, y: 0, filter: "blur(0px)" },
	exit: { x: 700, y: 0, filter: "blur(5px)" },
};

export default function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	const path = usePathname();
	const t = useTranslations("public.auth");

	return (
		<>
			<Image
				src={background}
				alt="Background"
				className="absolute dark:block hidden inset-0 object-cover w-full h-full blur-md"
				quality={100}
				priority
			/>
			<Image
				src={backgroundLight}
				alt="Background"
				className="block dark:hidden absolute inset-0 object-cover w-full h-full blur-md"
				quality={100}
				priority
			/>
			<Card className="w-full z-10 border-0 mx-auto md:border flex flex-col items-center justify-center md:justify-start h-dvh shadow-none md:max-w-sm overflow-hidden md:h-fit">
				<div className="w-full p-6">
					<Button variant={"outline"} className="w-full" asChild={true}>
						<Link href="/" className="flex items-center gap-2">
							<House className="w-4 h-4" />
							{t("home")}
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
		</>
	);
}
