"use client";

import {
	Credenza,
	CredenzaContent,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import Image from "next/image";

interface FilePreviewModalProps {
	isOpen: boolean;
	onClose: () => void;
	fileUrl: string;
	fileName: string;
}

export function FilePreviewModal({
	isOpen,
	onClose,
	fileUrl,
	fileName,
}: FilePreviewModalProps) {
	const isPdf = fileUrl.toLowerCase().endsWith(".pdf");
	console.log(fileName);

	return (
		<Credenza open={isOpen} onOpenChange={onClose}>
			<CredenzaContent className="max-w-4xl">
				<CredenzaHeader>
					<CredenzaTitle className="flex items-center justify-between">
						<span>{fileName}</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => window.open(fileUrl, "_blank")}
						>
							<Download className="h-4 w-4 mr-2" />
							Preuzmi
						</Button>
					</CredenzaTitle>
				</CredenzaHeader>
				<div className="mt-4">
					{isPdf ? (
						<embed
							src={fileUrl}
							className="w-full h-[600px]"
							title={fileName}
						/>
					) : (
						<div className="relative h-[600px]">
							<Image
								src={fileUrl}
								alt={fileName}
								fill
								className="object-contain"
							/>
						</div>
					)}
				</div>
			</CredenzaContent>
		</Credenza>
	);
}
