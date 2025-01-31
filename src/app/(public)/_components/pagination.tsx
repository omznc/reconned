"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";
interface PaginationOptions {
	totalItems: number;
	itemsPerPage: number;
	siblingsCount?: number;
}

export function Pagination({
	totalItems,
	itemsPerPage,
	siblingsCount = 1,
}: PaginationOptions) {
	const [currentPage, setPage] = useQueryState("page", parseAsInteger.withDefault(1).withOptions({
		shallow: false,
	}));
	const totalPages = Math.ceil(totalItems / itemsPerPage);

	// Don't render pagination if there's only one page
	if (totalPages <= 1) {
		return null;
	}

	// Generate array of page numbers to show
	const generatePages = () => {
		const pages: (number | "dots")[] = [];
		const min = Math.max(1, currentPage - siblingsCount);
		const max = Math.min(totalPages, currentPage + siblingsCount);

		// Handle start
		if (min > 1) {
			pages.push(1);
			if (min > 2) {
				pages.push("dots");
			}
		}

		// Add pages
		for (let i = min; i <= max; i++) {
			pages.push(i);
		}

		// Handle end
		if (max < totalPages) {
			if (max < totalPages - 1) {
				pages.push("dots");
			}
			pages.push(totalPages);
		}

		return pages;
	};

	const pages = generatePages();

	return (
		<div className="flex items-center justify-center gap-2">
			<Button
				variant="outline"
				size="icon"
				onClick={() => setPage(currentPage - 1)}
				disabled={currentPage <= 1}
			>
				<ChevronLeft className="h-4 w-4" />
			</Button>

			{pages.map((pageNum, i) =>
				pageNum === "dots" ? (
					<Button key={`dots-${i}`} variant="outline" size="icon" disabled>
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				) : (
					<Button
						key={pageNum}
						variant={currentPage === pageNum ? "default" : "outline"}
						size="icon"
						onClick={() => setPage(pageNum)}
					>
						{pageNum}
					</Button>
				),
			)}

			<Button
				variant="outline"
				size="icon"
				onClick={() => setPage(currentPage + 1)}
				disabled={currentPage >= totalPages}
			>
				<ChevronRight className="h-4 w-4" />
			</Button>
		</div>
	);
}
