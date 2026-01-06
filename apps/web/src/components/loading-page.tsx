import { Loader } from "@/components/loader";

export function LoadingPage() {
	return (
		<div className="size-full min-h-[500px] flex items-center justify-center">
			<Loader />
		</div>
	);
}
