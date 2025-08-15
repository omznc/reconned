"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { FileUploadItem } from "@/components/ui/file-upload";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";

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
	maxFiles = 5,
	initialFiles = [],
	onFilesChange,
}: UseFileUploadOptions) {
	const [files, setFiles] = useState<FileUploadItem[]>(initialFiles);
	const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
	const { setHasUnsavedChanges } = useUnsavedChanges();

	const updateFiles = useCallback(
		(newFiles: FileUploadItem[]) => {
			setFiles(newFiles);
			onFilesChange?.(newFiles);

			// Check if there are any new files (not existing ones) or removed files
			const hasNewFiles = newFiles.some((f) => f.file && !f.isExisting);
			const hasRemovedFiles = initialFiles.length !== newFiles.filter((f) => f.isExisting).length;

			setHasUnsavedChanges(hasNewFiles || hasRemovedFiles);
		},
		[onFilesChange, setHasUnsavedChanges, initialFiles.length],
	);

	const uploadAllFiles = useCallback(async (): Promise<string[]> => {
		const filesToUpload = files.filter((f) => f.file && !f.isExisting);

		if (filesToUpload.length === 0) {
			// Return existing file URLs
			return files.filter((f) => f.url).map((f) => f.url!);
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
				throw new Error("Upload failed");
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
			const existingUrls = files.filter((f) => f.isExisting && f.url).map((f) => f.url!);

			return [...existingUrls, ...successfulUploads];
		} catch (error) {
			throw new Error("Some files failed to upload");
		}
	}, [files, uploadFunction]);

	const resetToInitial = useCallback(() => {
		setFiles(initialFiles);
		setHasUnsavedChanges(false);
	}, [initialFiles, setHasUnsavedChanges]);

	const markAsSaved = useCallback(() => {
		// Mark all files as existing after successful form save
		setFiles((prevFiles) => prevFiles.map((f) => ({ ...f, isExisting: true, file: undefined })));
		setHasUnsavedChanges(false);
	}, [setHasUnsavedChanges]);

	return {
		files,
		setFiles: updateFiles,
		uploadAllFiles,
		uploadingFiles,
		resetToInitial,
		markAsSaved,
		hasUnsavedChanges:
			files.some((f) => f.file && !f.isExisting) ||
			initialFiles.length !== files.filter((f) => f.isExisting).length,
	};
}
