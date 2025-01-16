import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LoaderIcon } from "lucide-react";
import type { ReactNode } from "react";

interface LoaderSubmitButtonProps {
	isLoading?: boolean;
	className?: string;
	children?: ReactNode;
	variant?:
	| "default"
	| "destructive"
	| "outline"
	| "secondary"
	| "ghost"
	| "link";
	disabled?: boolean;
}

export function LoaderSubmitButton(props: LoaderSubmitButtonProps) {
	return (
		<Button
			variant={props.variant}
			disabled={props.isLoading || props.disabled}
			type="submit"
			className={cn(
				"flex w-full items-center justify-center gap-2",
				props.className,
			)}
		>
			{props.isLoading ? (
				<LoaderIcon className="h-4 w-4 animate-spin" />
			) : (
				props.children
			)}
		</Button>
	);
}
