"use client";

import { Loader, Upload, User, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ImageCropDialog } from "./image-crop-dialog.tsx";

interface AvatarUploadProps {
	value?: string | null;
	onChange: (url: string | null) => void;
	onFileSelect: (file: File | null) => void;
	selectedFile?: File | null;
	disabled?: boolean;
	className?: string;
}

export function AvatarUpload({
	value,
	onChange,
	onFileSelect,
	selectedFile,
	disabled = false,
	className,
}: AvatarUploadProps) {
	const [dragActive, setDragActive] = useState(false);
	const [cropFile, setCropFile] = useState<File | null>(null);
	const t = useTranslations("dashboard.user.settings");

	const onDrop = useCallback(async (acceptedFiles: File[]) => {
		if (acceptedFiles.length === 0) return;

		const file = acceptedFiles[0];
		if (file) {
			setCropFile(file);
		}
	}, []);

	const handleCrop = useCallback(
		async (croppedFile: File) => {
			onFileSelect(croppedFile);
			onChange(null);
		},
		[onFileSelect, onChange],
	);

	const handleCloseCrop = useCallback(() => {
		setCropFile(null);
	}, []);

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
							<div className="relative w-32 h-32 mx-auto bg-muted my-4 overflow-hidden">
								<Image
									src={displayValue}
									alt="User avatar"
									fill
									className="object-cover"
									sizes="128px"
								/>
							</div>

							<div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center rounded-full">
								<div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
									<Button
										type="button"
										variant="secondary"
										size="sm"
										onClick={handleReplace}
										disabled={disabled}
									>
										<Upload className="w-4 h-4 mr-2" />
										{t("replaceAvatar")}
									</Button>
									<Button
										type="button"
										variant="destructive"
										size="sm"
										onClick={handleRemove}
										disabled={disabled}
									>
										<X className="w-4 h-4 mr-2" />
										{t("removeAvatar")}
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
						"relative border-2 border-dashed w-32 h-32 mx-auto transition-all duration-200 cursor-pointer flex items-center justify-center",
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

					<div className="flex flex-col items-center justify-center text-center space-y-2">
						<div className="w-12 h-12 bg-muted flex items-center justify-center">
							<User className="w-6 h-6 text-muted-foreground" />
						</div>
						<p className="text-xs font-medium">{t("uploadAvatar")}</p>
					</div>
				</div>
			)}

			{displayValue && (
				<div className="flex items-center justify-center text-xs text-muted-foreground">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleRemove}
						disabled={disabled}
						className="h-6 px-2 text-xs"
					>
						<X className="w-3 h-3 mr-1" />
						{t("removeAvatar")}
					</Button>
				</div>
			)}

			<ImageCropDialog file={cropFile} onClose={handleCloseCrop} onCrop={handleCrop} />
		</div>
	);
}
