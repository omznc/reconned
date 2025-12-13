import { Loader } from "lucide-react";

export function LoadingPage() {
	return (
		<div className="size-full min-h-[500px] flex items-center justify-center">
			<Loader className="size-8 animate-spin" />
		</div>
	);
}
