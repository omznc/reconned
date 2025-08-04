"use client";

import { toast } from "sonner";
import { File, Image, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    type Dispatch,
    type SetStateAction,
    createContext,
    forwardRef,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState
} from "react";
import {
    useDropzone,
    type DropzoneState,
    type FileRejection,
    type DropzoneOptions,
} from "react-dropzone";



export interface FileUploadProgress {
    file: File;
    progress: number;
    url?: string;
    error?: string;
}

export interface FileDropProps {
    /** Array of currently uploaded file URLs */
    uploadedUrls: string[];
    /** Callback function when uploaded URLs change (files added/removed) */
    onUrlsChange: (urls: string[]) => void;
    /** Function to handle the actual file upload - should return the CDN URL or null if failed */
    onUpload: (file: File) => Promise<string | null>;
    /** Maximum number of files allowed */
    maxFiles?: number;
    /** Maximum file size in bytes (default: 5MB) */
    maxFileSize?: number;
    /** Object defining accepted file types - format: { "mimetype/*": [".ext1", ".ext2"] } */
    acceptedTypes: Record<string, string[]>;
    /** Whether the component is disabled */
    disabled?: boolean;
    /** Additional CSS class names */
    className?: string;
}

export function FileDrop({
    uploadedUrls,
    onUrlsChange,
    onUpload,
    maxFiles = 5,
    maxFileSize = 5 * 1024 * 1024,
    acceptedTypes,
    disabled = false,
    className = "",
}: FileDropProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<FileUploadProgress[]>([]);
    const [uploadedFileHashes, setUploadedFileHashes] = useState<Set<string>>(new Set());
    const t = useTranslations("components.fileDrop");

    const MAX_RETRIES = 3;

    const getFileHash = (file: File): string => {
        return `${file.name}-${file.size}-${file.lastModified}`;
    };

    const isImageFile = (file: File | string): boolean => {
        if (typeof file === "string") {
            return /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
        }
        return file.type.startsWith("image/");
    };

    const isPdfFile = (file: File | string): boolean => {
        if (typeof file === "string") {
            return /\.pdf$/i.test(file);
        }
        return file.type === "application/pdf";
    };

    const getFileTypeIcon = (file: File | string) => {
        if (isImageFile(file)) {
            return <Image className="w-4 h-4" />;
        }
        if (isPdfFile(file)) {
            return <File className="w-4 h-4 text-red-500" />;
        }
        return <File className="w-4 h-4" />;
    };

    const uploadFile = async (file: File, retryCount = 0): Promise<string | null> => {
        try {
            return await onUpload(file);
        } catch (error) {
            if (retryCount < MAX_RETRIES && (error as any).message.includes("503")) {
                await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
                return uploadFile(file, retryCount + 1);
            }
            throw error;
        }
    };

    const handleFileUpload = async (allFiles: File[]) => {
        if (allFiles.length === 0) return;

        const newFiles = allFiles.filter(file => {
            const hash = getFileHash(file);
            return !uploadedFileHashes.has(hash);
        });

        if (newFiles.length === 0) return;

        const newProgress: FileUploadProgress[] = newFiles.map(file => ({
            file,
            progress: 0,
        }));
        setUploadProgress(newProgress);

        const uploadPromises = newFiles.map(async (file, index) => {
            try {
                setUploadProgress(prev =>
                    prev.map((p, i) =>
                        i === index ? { ...p, progress: 50 } : p
                    )
                );

                const url = await uploadFile(file);

                if (url) {
                    setUploadProgress(prev =>
                        prev.map((p, i) =>
                            i === index ? { ...p, progress: 100, url } : p
                        )
                    );

                    const newUrls = [...uploadedUrls, url];
                    onUrlsChange(newUrls);

                    const fileHash = getFileHash(file);
                    setUploadedFileHashes(prev => new Set([...prev, fileHash]));

                    return url;
                }
                throw new Error("Upload failed");
            } catch (error) {
                setUploadProgress(prev =>
                    prev.map((p, i) =>
                        i === index
                            ? { ...p, progress: 0, error: (error as Error).message }
                            : p
                    )
                );
                throw error;
            }
        });

        try {
            await Promise.all(uploadPromises);
            setTimeout(() => {
                setUploadProgress([]);
            }, 2000);
        } catch (error) {
            toast.error(t("someFilesFailed"));
        }
    };

    const removeFile = (index: number) => {
        const newUrls = uploadedUrls.filter((_, i) => i !== index);
        onUrlsChange(newUrls);

        const updatedFiles = [...files];
        if (updatedFiles[index]) {
            const fileHash = getFileHash(updatedFiles[index]);
            setUploadedFileHashes(prev => {
                const newSet = new Set(prev);
                newSet.delete(fileHash);
                return newSet;
            });
            updatedFiles.splice(index, 1);
            setFiles(updatedFiles);
        }

        setUploadProgress([]);
    };

    const removeProgressItem = (index: number) => {
        setUploadProgress(prev => prev.filter((_, i) => i !== index));
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {(uploadedUrls.length > 0 || uploadProgress.length > 0) && (
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                        {uploadedUrls.map((url, index) => (
                            <div key={`file-${url}`} className="relative group">
                                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted border">
                                    {isImageFile(url) ? (
                                        <img
                                            src={url}
                                            alt={`Upload ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center p-2">
                                            {getFileTypeIcon(url)}
                                            <span className="text-xs text-muted-foreground mt-1 truncate max-w-full">
                                                {url.split('/').pop()?.split('_')[0] || 'File'}
                                            </span>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeFile(index)}
                                        disabled={disabled}
                                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-destructive/80"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {uploadProgress.map((progress, index) => (
                            <div key={`progress-${progress.file.name}-${index}`} className="relative group">
                                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted border">
                                    {isImageFile(progress.file) ? (
                                        <img
                                            src={URL.createObjectURL(progress.file)}
                                            alt={progress.file.name}
                                            className={`w-full h-full object-cover transition-opacity duration-500 ${progress.progress < 100 ? 'opacity-50 animate-pulse' : 'opacity-100'
                                                }`}
                                        />
                                    ) : (
                                        <div className={`w-full h-full flex flex-col items-center justify-center p-2 transition-opacity duration-500 ${progress.progress < 100 ? 'opacity-50 animate-pulse' : 'opacity-100'
                                            }`}>
                                            {getFileTypeIcon(progress.file)}
                                            <span className="text-xs text-muted-foreground mt-1 truncate max-w-full">
                                                {progress.file.name.split('.')[0]}
                                            </span>
                                        </div>
                                    )}

                                    {progress.progress < 100 && !progress.error && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                            <div className="bg-white/90 rounded-full p-1.5">
                                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        </div>
                                    )}

                                    {progress.error && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 backdrop-blur-sm">
                                            <div className="bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                                                <span className="text-sm font-bold">!</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {progress.progress < 100 && !progress.error && (
                                    <div className="absolute -bottom-1 left-0 right-0 h-1 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-300 rounded-full"
                                            style={{ width: `${progress.progress}%` }}
                                        />
                                    </div>
                                )}

                                {progress.error && (
                                    <div className="absolute -bottom-1 left-0 right-0 h-1 bg-destructive/30 rounded-full" />
                                )}

                                {(progress.error || progress.progress === 100) && (
                                    <button
                                        type="button"
                                        onClick={() => removeProgressItem(index)}
                                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-destructive/80"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {uploadedUrls.length < maxFiles && !disabled && !(maxFiles === 1 && uploadedUrls.length > 0) && (
                <FileUploader
                    value={files}
                    onValueChange={(newFiles) => {
                        const files = newFiles || [];
                        setFiles(files);
                        handleFileUpload(files);
                    }}
                    dropzoneOptions={{
                        accept: acceptedTypes,
                        maxFiles: maxFiles - uploadedUrls.length,
                        maxSize: maxFileSize,
                        disabled: false,
                    }}
                    className="relative bg-background rounded-lg"
                >
                    <FileInput className="border-2 border-dashed border-muted-foreground/40 hover:border-muted-foreground/60 transition-colors rounded-lg">
                        <div className="flex items-center justify-center flex-col p-8 w-full">
                            <div className="text-center">
                                <div className="text-sm text-muted-foreground">
                                    {t("dropFilesHere")}
                                </div>
                                <div className="text-xs text-muted-foreground/70 mt-1">
                                    {t("maxFiles", {
                                        count: maxFiles,
                                        maxSize: Math.round(maxFileSize / 1024 / 1024)
                                    })}
                                </div>
                            </div>
                        </div>
                    </FileInput>
                    <FileUploaderContent>
                        {files.map((file, i) => (
                            <FileUploaderItem key={i} index={i}>
                                <div className="flex items-center gap-2">
                                    {getFileTypeIcon(file)}
                                    <span className="text-sm">{file.name}</span>
                                </div>
                            </FileUploaderItem>
                        ))}
                    </FileUploaderContent>
                </FileUploader>
            )}
        </div>
    );
}


// The following component was stolen
type DirectionOptions = "rtl" | "ltr" | undefined;

type FileUploaderContextType = {
    dropzoneState: DropzoneState;
    isLOF: boolean;
    isFileTooBig: boolean;
    removeFileFromSet: (index: number) => void;
    activeIndex: number;
    setActiveIndex: Dispatch<SetStateAction<number>>;
    orientation: "horizontal" | "vertical";
    direction: DirectionOptions;
};

const FileUploaderContext = createContext<FileUploaderContextType | null>(null);

const useFileUpload = () => {
    const context = useContext(FileUploaderContext);
    if (!context) {
        throw new Error("useFileUpload must be used within a FileUploaderProvider");
    }
    return context;
};

type FileUploaderProps = {
    value: File[] | null;
    reSelect?: boolean;
    onValueChange: (value: File[] | null) => void;
    dropzoneOptions: DropzoneOptions;
    orientation?: "horizontal" | "vertical";
};

const FileUploader = forwardRef<
    HTMLDivElement,
    FileUploaderProps & React.HTMLAttributes<HTMLDivElement>
>(
    (
        {
            className,
            dropzoneOptions,
            value,
            onValueChange,
            reSelect,
            orientation = "vertical",
            children,
            dir,
            ...props
        },
        ref,
    ) => {
        const [isFileTooBig, setIsFileTooBig] = useState(false);
        const [isLOF, setIsLOF] = useState(false);
        const [activeIndex, setActiveIndex] = useState(-1);
        const {
            accept = {
                "image/*": [".jpg", ".jpeg", ".png", ".gif"],
            },
            maxFiles = 1,
            maxSize = 4 * 1024 * 1024,
            multiple = true,
        } = dropzoneOptions;

        const reSelectAll = maxFiles === 1 ? true : reSelect;
        const direction: DirectionOptions = dir === "rtl" ? "rtl" : "ltr";

        const removeFileFromSet = useCallback(
            (i: number) => {
                if (!value) return;
                const newFiles = value.filter((_, index) => index !== i);
                onValueChange(newFiles);
            },
            [value, onValueChange],
        );

        const handleKeyDown = useCallback(
            (e: React.KeyboardEvent<HTMLDivElement>) => {
                e.preventDefault();
                e.stopPropagation();

                if (!value) return;

                const moveNext = () => {
                    const nextIndex = activeIndex + 1;
                    setActiveIndex(nextIndex > value.length - 1 ? 0 : nextIndex);
                };

                const movePrev = () => {
                    const nextIndex = activeIndex - 1;
                    setActiveIndex(nextIndex < 0 ? value.length - 1 : nextIndex);
                };

                const prevKey =
                    orientation === "horizontal"
                        ? direction === "ltr"
                            ? "ArrowLeft"
                            : "ArrowRight"
                        : "ArrowUp";

                const nextKey =
                    orientation === "horizontal"
                        ? direction === "ltr"
                            ? "ArrowRight"
                            : "ArrowLeft"
                        : "ArrowDown";

                if (e.key === nextKey) {
                    moveNext();
                } else if (e.key === prevKey) {
                    movePrev();
                } else if (e.key === "Enter" || e.key === "Space") {
                    if (activeIndex === -1) {
                        dropzoneState.inputRef.current?.click();
                    }
                } else if (e.key === "Delete" || e.key === "Backspace") {
                    if (activeIndex !== -1) {
                        removeFileFromSet(activeIndex);
                        if (value.length - 1 === 0) {
                            setActiveIndex(-1);
                            return;
                        }
                        movePrev();
                    }
                } else if (e.key === "Escape") {
                    setActiveIndex(-1);
                }
            },
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [value, activeIndex, removeFileFromSet],
        );

        const onDrop = useCallback(
            (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
                const files = acceptedFiles;

                if (!files) {
                    toast.error("file error , probably too big");
                    return;
                }

                const newValues: File[] = value ? [...value] : [];

                if (reSelectAll) {
                    newValues.splice(0, newValues.length);
                }

                files.forEach((file) => {
                    if (newValues.length < maxFiles) {
                        newValues.push(file);
                    }
                });

                onValueChange(newValues);

                if (rejectedFiles.length > 0) {
                    for (let i = 0; i < rejectedFiles.length; i++) {
                        if (rejectedFiles[i]?.errors[0]?.code === "file-too-large") {
                            toast.error(
                                `File is too large. Max size is ${maxSize / 1024 / 1024}MB`,
                            );
                            break;
                        }
                        if (rejectedFiles[i]?.errors[0]?.message) {
                            toast.error(rejectedFiles[i]?.errors[0]?.message);
                            break;
                        }
                    }
                }
            },
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [reSelectAll, value],
        );

        useEffect(() => {
            if (!value) return;
            if (value.length === maxFiles) {
                setIsLOF(true);
                return;
            }
            setIsLOF(false);
        }, [value, maxFiles]);

        const opts = dropzoneOptions
            ? dropzoneOptions
            : { accept, maxFiles, maxSize, multiple };

        const dropzoneState = useDropzone({
            ...opts,
            onDrop,
            onDropRejected: () => setIsFileTooBig(true),
            onDropAccepted: () => setIsFileTooBig(false),
        });

        return (
            <FileUploaderContext.Provider
                value={{
                    dropzoneState,
                    isLOF,
                    isFileTooBig,
                    removeFileFromSet,
                    activeIndex,
                    setActiveIndex,
                    orientation,
                    direction,
                }}
            >
                <div
                    ref={ref}
                    tabIndex={0}
                    onKeyDownCapture={handleKeyDown}
                    className={cn(
                        "grid w-full focus:outline-hidden overflow-hidden ",
                        className,
                        {
                            "gap-2": value && value.length > 0,
                        },
                    )}
                    dir={dir}
                    {...props}
                >
                    {children}
                </div>
            </FileUploaderContext.Provider>
        );
    },
);

FileUploader.displayName = "FileUploader";

const FileUploaderContent = forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ children, className, ...props }, ref) => {
    const { orientation } = useFileUpload();
    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div
            className={cn("w-full px-1")}
            ref={containerRef}
            aria-description="content file holder"
        >
            <div
                {...props}
                ref={ref}
                className={cn(
                    "flex rounded-xl gap-1",
                    orientation === "horizontal" ? "flex-raw flex-wrap" : "flex-col",
                    className,
                )}
            >
                {children}
            </div>
        </div>
    );
});

FileUploaderContent.displayName = "FileUploaderContent";

const FileUploaderItem = forwardRef<
    HTMLDivElement,
    { index: number; } & React.HTMLAttributes<HTMLDivElement>
>(({ className, index, children, ...props }, ref) => {
    const { removeFileFromSet, activeIndex, direction } = useFileUpload();
    const isSelected = index === activeIndex;
    return (
        <div
            ref={ref}
            className={cn(
                "h-6 p-1 justify-between cursor-pointer relative bg-transparent hover:bg-muted",
                className,
                isSelected ? "bg-muted" : "",
            )}
            {...props}
        >
            <div className="font-medium leading-none tracking-tight flex items-center gap-1.5 h-full w-full">
                {children}
            </div>
            <button
                type="button"
                className={cn(
                    "absolute",
                    direction === "rtl" ? "top-1 left-1" : "top-1 right-1",
                )}
                onClick={() => removeFileFromSet(index)}
            >
                <span className="sr-only">remove item {index}</span>
                <X className="w-4 h-4 hover:stroke-destructive duration-200 ease-in-out" />
            </button>
        </div>
    );
});

FileUploaderItem.displayName = "FileUploaderItem";

const FileInput = forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
    const { dropzoneState, isFileTooBig, isLOF } = useFileUpload();
    const rootProps = isLOF ? {} : dropzoneState.getRootProps();
    return (
        <div
            ref={ref}
            {...props}
            className={`relative w-full ${isLOF ? "opacity-50 cursor-not-allowed " : "cursor-pointer "
                }`}
        >
            <div
                className={cn(
                    `w-full rounded-lg duration-300 ease-in-out
         ${dropzoneState.isDragAccept
                        ? "border-green-500"
                        : dropzoneState.isDragReject || isFileTooBig
                            ? "border-red-500"
                            : "border-neutral-300"
                    }`,
                    className,
                )}
                {...rootProps}
            >
                {children}
            </div>
            <Input
                ref={dropzoneState.inputRef}
                disabled={isLOF}
                {...dropzoneState.getInputProps()}
                className={`${isLOF ? "cursor-not-allowed" : ""}`}
            />
        </div>
    );
});

FileInput.displayName = "FileInput";
