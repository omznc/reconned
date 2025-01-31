"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

interface PaginationOptions {
	totalItems: number;
	currentPage: number;
	itemsPerPage: number;
	siblingsCount?: number;
}

export function Pagination({
	totalItems,
	currentPage,
	itemsPerPage,
	siblingsCount = 1,
}: PaginationOptions) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const totalPages = Math.ceil(totalItems / itemsPerPage);

	// Don't render pagination if there's only one page
	if (totalPages <= 1) {
		return null;
	}

	const createPageUrl = (page: number) => {
		const params = new URLSearchParams(searchParams);
		params.set("page", page.toString());
		return `${pathname}?${params.toString()}`;
	};

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
				asChild
				disabled={currentPage === 1}
			>
				<Link href={createPageUrl(currentPage - 1)}>
					<ChevronLeft className="h-4 w-4" />
				</Link>
			</Button>

			{pages.map((page, i) =>
				page === "dots" ? (
					<Button key={`dots-${i}`} variant="outline" size="icon" disabled>
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				) : (
					<Button
						key={page}
						variant={currentPage === page ? "default" : "outline"}
						size="icon"
						asChild
					>
						<Link href={createPageUrl(page)}>{page}</Link>
					</Button>
				),
			)}

			<Button
				variant="outline"
				size="icon"
				asChild
				disabled={currentPage === totalPages}
			>
				<Link href={createPageUrl(currentPage + 1)}>
					<ChevronRight className="h-4 w-4" />
				</Link>
			</Button>
		</div>
	);
}
