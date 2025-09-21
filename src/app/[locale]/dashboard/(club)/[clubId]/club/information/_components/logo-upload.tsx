"use client";

import { Image as ImageIcon, Upload, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface LogoUploadProps {
	value?: string | null;
	onChange: (url: string | null) => void;
	onFileSelect: (file: File | null) => void;
	selectedFile?: File | null;
	disabled?: boolean;
	className?: string;
}

export function LogoUpload({
	value,
	onChange,
	onFileSelect,
	selectedFile,
	disabled = false,
	className,
}: LogoUploadProps) {
	const [dragActive, setDragActive] = useState(false);
	const t = useTranslations();

	const onDrop = useCallback(
		async (acceptedFiles: File[]) => {
			if (acceptedFiles.length === 0) return;

			const file = acceptedFiles[0];
			if (!file) return;

			onFileSelect(file);
			onChange(null);
		},
		[onFileSelect, onChange],
	);

	const { getRootProps, getInputProps, isDragAccept, isDragReject } = useDropzone({
		onDrop,
		accept: {
			"image/jpeg": [".jpg", ".jpeg"],
			"image/png": [".png"],
			"image/webp": [".webp"],
		},
		maxFiles: 1,
		maxSize: 4 * 1024 * 1024,
		disabled: disabled,
		onDragEnter: () => setDragActive(true),
		onDragLeave: () => setDragActive(false),
		onDropAccepted: () => setDragActive(false),
		onDropRejected: () => setDragActive(false),
	});

	const handleRemove = () => {
		onChange(null);
		onFileSelect(null);
	};

	const handleReplace = () => {
		onChange(null);
		onFileSelect(null);
	};

	const displayValue = value || (selectedFile ? URL.createObjectURL(selectedFile) : null);

	return (
		<div className={cn("space-y-4", className)}>
			{displayValue ? (
				<Card className="overflow-hidden">
					<CardContent className="p-0">
						<div className="relative group">
							<div className="relative w-full h-48 bg-muted">
								<Image
									src={displayValue}
									alt="Club logo"
									fill
									className="object-contain"
									sizes="(max-width: 768px) 100vw, 400px"
								/>
							</div>

							<div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
								<div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
									<Button
										type="button"
										variant="secondary"
										size="sm"
										onClick={handleReplace}
										disabled={disabled}
									>
										<Upload className="w-4 h-4 mr-2" />
										{t("dashboard.club.info.replaceLogo")}
									</Button>
									<Button
										type="button"
										variant="destructive"
										size="sm"
										onClick={handleRemove}
										disabled={disabled}
									>
										<X className="w-4 h-4 mr-2" />
										{t("dashboard.club.info.removeLogo")}
									</Button>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			) : (
				<div
					{...getRootProps()}
					className={cn(
						"relative border-2 border-dashed rounded-lg p-8 transition-all duration-200 cursor-pointer",
						{
							"border-primary bg-primary/5": isDragAccept || dragActive,
							"border-destructive bg-destructive/5": isDragReject,
							"border-muted-foreground/25 hover:border-muted-foreground/50":
								!isDragAccept && !isDragReject && !dragActive,
							"opacity-50 cursor-not-allowed": disabled,
						},
					)}
				>
					<input {...getInputProps()} />

					<div className="flex flex-col items-center justify-center text-center space-y-4">
						<div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
							<ImageIcon className="w-8 h-8 text-muted-foreground" />
						</div>
						<div className="space-y-2">
							<p className="text-sm font-medium">{t("dashboard.club.info.uploadLogo")}</p>
							<p className="text-xs text-muted-foreground">
								{t("dashboard.club.info.logoUploadDescription")}
							</p>
							<p className="text-xs text-muted-foreground">{t("dashboard.club.info.logoFormats")}</p>
						</div>
					</div>
				</div>
			)}

			{displayValue && (
				<div className="flex items-center justify-between text-xs text-muted-foreground">
					<span>
						{selectedFile ? t("dashboard.club.info.logoSelected") : t("dashboard.club.info.logoUploaded")}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleRemove}
						disabled={disabled}
						className="h-6 px-2 text-xs"
					>
						<X className="w-3 h-3 mr-1" />
						{t("dashboard.club.info.removeLogo")}
					</Button>
				</div>
			)}
		</div>
	);
}
