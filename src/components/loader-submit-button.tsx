import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2Icon } from "lucide-react";
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
}

export function LoaderSubmitButton(props: LoaderSubmitButtonProps) {
	return (
		<Button
			variant={props.variant}
			disabled={props.isLoading}
			type="submit"
			className={cn("flex items-center justify-center gap-2", props.className)}
		>
			{props.isLoading ? (
				<Loader2Icon className="h-4 w-4 animate-spin" />
			) : (
				props.children
			)}
		</Button>
	);
}
