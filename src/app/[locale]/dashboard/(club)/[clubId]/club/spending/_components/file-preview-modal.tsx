"use client";

import { Download, ExternalLink } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle } from "@/components/ui/credenza";
import { useLogger } from "next-axiom";

interface FilePreviewModalProps {
	isOpen: boolean;
	onClose: () => void;
	fileUrl: string;
	fileName: string;
}

export function FilePreviewModal({ isOpen, onClose, fileUrl, fileName }: FilePreviewModalProps) {
	const isPdf = fileUrl.toLowerCase().endsWith(".pdf");
	const t = useTranslations();
	const [isDownloading, setIsDownloading] = useState(false);
	const logger = useLogger();
	const handleDownload = async () => {
		setIsDownloading(true);
		try {
			// Create a temporary anchor element to trigger download
			const link = document.createElement("a");
			link.href = fileUrl;
			link.download = fileName;
			link.target = "_blank";
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		} catch (error) {
			logger.error("Download failed:", { error });
		} finally {
			setIsDownloading(false);
		}
	};

	return (
		<Credenza open={isOpen} onOpenChange={onClose}>
			<CredenzaContent className="max-w-4xl">
				<CredenzaHeader>
					<CredenzaTitle className="flex items-center justify-between">
						<span>{fileName}</span>
						<div className="flex gap-2">
							<Button variant="outline" size="sm" onClick={() => window.open(fileUrl, "_blank")}>
								<ExternalLink className="h-4 w-4 mr-2" />
								{t("dashboard.club.spending.receipt.open")}
							</Button>
							<Button variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading}>
								<Download className="h-4 w-4 mr-2" />
								{isDownloading
									? t("dashboard.club.spending.receipt.downloading")
									: t("dashboard.club.spending.receipt.download")}
							</Button>
						</div>
					</CredenzaTitle>
				</CredenzaHeader>
				<div className="mt-4">
					{isPdf ? (
						<embed src={fileUrl} className="w-full h-[600px]" title={fileName} />
					) : (
						<div className="relative h-[600px]">
							<Image src={fileUrl} alt={fileName} fill className="object-contain" />
						</div>
					)}
				</div>
			</CredenzaContent>
		</Credenza>
	);
}
