"use client";

import { useLogger } from "next-axiom";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { FileUploadItem } from "@/components/ui/file-upload";

export interface UseFileUploadOptions {
	/** Function to upload a single file and return the CDN URL */
	uploadFunction: (file: File) => Promise<string | null>;
	/** Maximum number of files */
	maxFiles?: number;
	/** Initial files (for editing forms) */
	initialFiles?: FileUploadItem[];
	/** Callback when files change */
	onFilesChange?: (files: FileUploadItem[]) => void;
}

export function useFileUpload({
	uploadFunction,
	initialFiles = [],
	onFilesChange,
	maxFiles = 5,
}: UseFileUploadOptions) {
	const [files, setFiles] = useState<FileUploadItem[]>(initialFiles);
	const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
	const logger = useLogger();
	const t = useTranslations("errors.fileUpload");

	const updateFiles = useCallback(
		(newFiles: FileUploadItem[]) => {
			setFiles(newFiles);
			onFilesChange?.(newFiles);
		},
		[onFilesChange, initialFiles.length],
	);

	const uploadAllFiles = useCallback(async (): Promise<string[]> => {
		const filesToUpload = files.filter((f) => f.file && !f.isExisting);

		if (filesToUpload.length === 0) {
			// Return existing file URLs
			// biome-ignore lint/style/noNonNullAssertion: File URLs are guaranteed to be non-null
			return files.filter((f) => f.url).map((f) => f.url!);
		}

		if (filesToUpload.length > maxFiles) {
			throw new ActionError(t("maximumNumberOfFilesExceeded", { maxFiles }));
		}

		const uploadPromises = filesToUpload.map(async (fileItem) => {
			if (!fileItem.file) return null;

			setUploadingFiles((prev) => new Set([...prev, fileItem.id]));

			try {
				const url = await uploadFunction(fileItem.file);
				if (url) {
					// Update the file item with the URL and mark as existing
					setFiles((prevFiles) =>
						prevFiles.map((f) =>
							f.id === fileItem.id ? { ...f, url, isExisting: true, file: undefined } : f,
						),
					);
					return url;
				}
				throw new ActionError(t("uploadFailed"));
			} catch (error) {
				toast.error(`Failed to upload ${fileItem.name}`);
				throw error;
			} finally {
				setUploadingFiles((prev) => {
					const newSet = new Set(prev);
					newSet.delete(fileItem.id);
					return newSet;
				});
			}
		});

		try {
			const results = await Promise.all(uploadPromises);
			const successfulUploads = results.filter(Boolean) as string[];

			// Include existing file URLs
			// biome-ignore lint/style/noNonNullAssertion: File URLs are guaranteed to be non-null
			const existingUrls = files.filter((f) => f.isExisting && f.url).map((f) => f.url!);

			return [...existingUrls, ...successfulUploads];
		} catch (error) {
			logger.error("Some files failed to upload", { error });
			throw new ActionError(t("someFilesFailedToUpload"));
		}
	}, [files, uploadFunction, t, maxFiles]);

	const resetToInitial = useCallback(() => {
		setFiles(initialFiles);
	}, [initialFiles]);

	const markAsSaved = useCallback(() => {
		// Mark all files as existing after successful form save
		setFiles((prevFiles) => prevFiles.map((f) => ({ ...f, isExisting: true, file: undefined })));
	}, []);

	return {
		files,
		setFiles: updateFiles,
		uploadAllFiles,
		uploadingFiles,
		resetToInitial,
		markAsSaved,
	};
}
