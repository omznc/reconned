import { ChevronLeft, ChevronRight } from "lucide-react";
import { useExtracted } from "next-intl";
import { Button } from "@/components/ui/button";

interface ListingPaginationProps {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}

/** Up to five page numbers around the current page. */
function pageWindow(page: number, totalPages: number) {
	const count = Math.min(5, totalPages);
	const start = Math.max(1, Math.min(page - 2, totalPages - count + 1));
	return Array.from({ length: count }, (_, index) => start + index);
}

export function ListingPagination({ page, totalPages, onPageChange }: ListingPaginationProps) {
	const t = useExtracted();
	if (totalPages <= 1) {
		return null;
	}
	return (
		<nav className="mt-4 flex items-center justify-center gap-2" aria-label={t("Pagination")}>
			<Button
				variant="outline"
				size="icon"
				onClick={() => onPageChange(page - 1)}
				disabled={page <= 1}
				aria-label={t("Previous page")}
			>
				<ChevronLeft className="size-4" aria-hidden={true} />
			</Button>
			{pageWindow(page, totalPages).map((pageNum) => (
				<Button
					key={pageNum}
					variant={page === pageNum ? "default" : "outline"}
					size="icon"
					onClick={() => onPageChange(pageNum)}
					aria-label={t("Page {page}", { page: String(pageNum) })}
					aria-current={page === pageNum ? "page" : undefined}
					className="tabular-nums"
				>
					{pageNum}
				</Button>
			))}
			<Button
				variant="outline"
				size="icon"
				onClick={() => onPageChange(page + 1)}
				disabled={page >= totalPages}
				aria-label={t("Next page")}
			>
				<ChevronRight className="size-4" aria-hidden={true} />
			</Button>
		</nav>
	);
}
