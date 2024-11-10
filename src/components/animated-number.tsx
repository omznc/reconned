"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

interface AnimatedNumberProps {
	value: number;
	className?: string;
}

export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
	const spring = useSpring(0, {
		mass: 0.8,
		stiffness: 75,
		damping: 15,
	});

	const display = useTransform(spring, (current) => {
		return Math.round(current);
	});

	useEffect(() => {
		spring.set(value);
	}, [spring, value]);

	// @ts-ignore This is an issue, not a problem that I made
	return <motion.span className={className}>{display}</motion.span>;
}
