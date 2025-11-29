"use client";

import { Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { FileUploadItem } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SingleImageUploadVariant = "avatar" | "logo" | "banner";

const variantStyles: Record<SingleImageUploadVariant, string> = {
    avatar: "h-32 w-32",
    logo: "h-32 w-32",
    banner: "h-48 w-full",
};

export interface SingleImageUploadProps {
    value?: FileUploadItem[];
    onChange: (files: FileUploadItem[]) => void;
    disabled?: boolean;
    accept?: Record<string, string[]>;
    maxFileSize?: number;
    variant?: SingleImageUploadVariant;
    className?: string;
}

export function SingleImageUpload({
    value = [],
    onChange,
    disabled = false,
    accept = {
        "image/*": [".jpg", ".jpeg", ".png", ".webp"],
    },
    maxFileSize = 4 * 1024 * 1024,
    variant = "logo",
    className,
}: SingleImageUploadProps) {
    const t = useTranslations();
    const file = value[0];
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        if (file?.file) {
            const url = URL.createObjectURL(file.file);
            setPreview(url);
            return () => {
                URL.revokeObjectURL(url);
            };
        }
        setPreview(null);
        return undefined;
    }, [file?.file]);

    const displayUrl = useMemo(() => {
        if (file?.file) {
            return preview;
        }
        return file?.url;
    }, [file?.file, file?.url, preview]);

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            if (disabled || acceptedFiles.length === 0) {
                return;
            }

            const [newFile] = acceptedFiles;
            if (!newFile) {
                return;
            }

            const uploadItem: FileUploadItem = {
                id: `single-${Date.now()}-${Math.random()}`,
                file: newFile,
                name: newFile.name,
                type: newFile.type,
                size: newFile.size,
                isExisting: false,
            };

            onChange([uploadItem]);
        },
        [disabled, onChange],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept,
        maxSize: maxFileSize,
        multiple: false,
        disabled,
    });

    const handleRemove = () => {
        if (disabled) {
            return;
        }
        onChange([]);
    };

    return (
        <div className={cn("space-y-2", className)}>
            <div
                {...getRootProps()}
                className={cn(
                    "group relative rounded-md flex cursor-pointer items-center justify-center border-2 border-dashed bg-muted transition hover:border-primary hover:bg-primary/5",
                    variantStyles[variant],
                    {
                        "ring-2 ring-primary": isDragActive,
                        "cursor-not-allowed opacity-60": disabled,
                    },
                )}
            >
                <input {...getInputProps()} />
                {displayUrl ? (
                    <div className={cn("absolute inset-0 overflow-hidden rounded-md")}>
                        <img src={displayUrl} alt={file?.name || ""} className={cn("h-full w-full rounded-md", {
                            "object-cover": variant !== 'logo',
                            "object-contain": variant === 'logo',
                        })} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 opacity-0 transition group-hover:opacity-100">
                            <Upload className="h-5 w-5 text-white" />
                            <p className="text-sm font-medium text-white text-center">
                                {t("components.singleImageUpload.changeImage")}
                            </p>
                            <p className="text-xs text-white/70 text-center">
                                {t("components.singleImageUpload.dragOrClick")}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground rounded-md">
                        <Upload className="mb-2 h-6 w-6" />
                        <p className="text-sm font-medium text-foreground">
                            {t("components.singleImageUpload.uploadImage")}
                        </p>
                        <p className="text-xs">
                            {t("components.singleImageUpload.dragOrClick")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                            {t("components.singleImageUpload.maxFile", {
                                size: Math.round(maxFileSize / (1024 * 1024)),
                            })}
                        </p>
                    </div>
                )}
            </div>
            {file && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 p-0 shadow-none! bg-transparent hover:bg-transparent w-fit gap-1 text-muted-foreground hover:text-destructive"
                    onClick={handleRemove}
                    disabled={disabled}
                >
                    <X className="h-4 w-4" />
                    {t("components.singleImageUpload.removeImage")}
                </Button>
            )}
        </div>
    );
}
