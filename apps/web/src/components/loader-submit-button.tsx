import type { ReactNode } from "react";
import { Loader } from "@/components/loader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LoaderSubmitButtonProps {
	isLoading?: boolean;
	className?: string;
	children?: ReactNode;
	variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
	disabled?: boolean;
}

export function LoaderSubmitButton(props: LoaderSubmitButtonProps) {
	return (
		<Button
			variant={props.variant}
			disabled={props.isLoading || props.disabled}
			type="submit"
			className={cn("flex w-full items-center justify-center gap-2", props.className)}
		>
			{props.isLoading ? <Loader size={16} /> : props.children}
		</Button>
	);
}
