"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X, File as FileIcon, Image as ImageIcon, Upload } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

export interface FileUploadItem {
    id: string;
    file?: File;
    url?: string;
    name: string;
    type: string;
    size?: number;
    isExisting?: boolean;
}

export interface FileUploadProps {
    /** Current files */
    value: FileUploadItem[];
    /** Callback when files change */
    onChange: (files: FileUploadItem[]) => void;
    /** Maximum number of files */
    maxFiles?: number;
    /** Maximum file size in bytes */
    maxFileSize?: number;
    /** Accepted file types */
    accept?: Record<string, string[]>;
    /** Whether component is disabled */
    disabled?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Whether to show preview images */
    showPreview?: boolean;
    /** Whether to allow multiple files */
    multiple?: boolean;
}

export function FileUpload({
    value = [],
    onChange,
    maxFiles = 5,
    maxFileSize = 5 * 1024 * 1024, // 5MB
    accept = {
        "image/*": [".jpg", ".jpeg", ".png", ".webp"],
        "application/pdf": [".pdf"],
    },
    disabled = false,
    className,
    showPreview = true,
    multiple = true,
}: FileUploadProps) {
    const [dragActive, setDragActive] = useState(false);
    const t = useExtracted()

    const canAddMore = multiple ? value.length < maxFiles : value.length === 0;

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            if (!canAddMore || disabled) return;

            const newFiles: FileUploadItem[] = acceptedFiles
                .slice(0, multiple ? maxFiles - value.length : 1)
                .map((file) => ({
                    id: `new-${Date.now()}-${Math.random()}`,
                    file,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    isExisting: false,
                }));

            if (multiple) {
                onChange([...value, ...newFiles]);
            } else {
                onChange(newFiles);
            }
        },
        [value, onChange, maxFiles, canAddMore, disabled, multiple]
    );

    const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
        onDrop,
        accept,
        maxSize: maxFileSize,
        multiple,
        disabled: disabled || !canAddMore,
        onDragEnter: () => setDragActive(true),
        onDragLeave: () => setDragActive(false),
        onDropAccepted: () => setDragActive(false),
        onDropRejected: () => setDragActive(false),
    });

    const removeFile = (id: string) => {
        onChange(value.filter((item) => item.id !== id));
    };

    const isImageFile = (type: string): boolean => {
        return type.startsWith("image/");
    };

    const getFileIcon = (type: string) => {
        if (isImageFile(type)) {
            return <ImageIcon className="w-4 h-4" />;
        }
        return <FileIcon className="w-4 h-4 text-muted-foreground" />;
    };

    const formatFileSize = (bytes?: number): string => {
        if (!bytes) return "";
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)}MB`;
    };

    return (
        <div className={cn("space-y-4", className)}>
            {/* File List */}
            {value.length > 0 && (
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {value.map((item) => (
                        <div key={item.id} className="relative group">
                            <div className="relative aspect-square rounded-lg border bg-muted overflow-hidden">
                                {showPreview && isImageFile(item.type) ? (
                                    <img
                                        src={item.file ? URL.createObjectURL(item.file) : item.url}
                                        alt={item.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-2">
                                        {getFileIcon(item.type)}
                                        <span className="text-xs text-center text-muted-foreground mt-1 truncate w-full">
                                            {item.name}
                                        </span>
                                        {item.size && (
                                            <span className="text-xs text-muted-foreground">
                                                {formatFileSize(item.size)}
                                            </span>
                                        )}
                                    </div>
                                )}

                                <Button
                                    type="button"
                                    onClick={() => removeFile(item.id)}
                                    disabled={disabled}
                                    size="sm"
                                    variant="destructive"
                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Area */}
            {canAddMore && (
                <div
                    {...getRootProps()}
                    className={cn(
                        "border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer",
                        {
                            "border-primary bg-primary/5": isDragAccept || dragActive,
                            "border-destructive bg-destructive/5": isDragReject,
                            "border-muted-foreground/25 hover:border-muted-foreground/50":
                                !isDragAccept && !isDragReject && !dragActive,
                            "opacity-50 cursor-not-allowed": disabled,
                        }
                    )}
                >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center justify-center space-y-2 text-center">
                        <Upload className="w-8 h-8 text-muted-foreground" />
                        <div className="space-y-1">
                            <p className="text-sm font-medium">
                                {dragActive ? t("Drop files here") : t("Click to upload or drag and drop")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {multiple && t("Up to {count} files", { count: String(maxFiles) })}
                                {t("Maximum size of {size} MB", { size: String(Math.round(maxFileSize / (1024 * 1024))) })}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* File count indicator */}
            {multiple && value.length > 0 && (
                <p className="text-xs text-muted-foreground">
                    {t("{count} of {maxFiles} files added", { count: String(value.length), maxFiles: String(maxFiles) })}
                </p>
            )}
        </div>
    );
}
