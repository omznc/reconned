"use client";

import { useCallback, useState } from "react";
import ReactCrop, { type Crop } from "react-image-crop";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import "react-image-crop/dist/ReactCrop.css";
import { useExtracted } from "next-intl";

interface BannerCropDialogProps {
	file: File | null;
	onClose: () => void;
	onCrop: (file: File) => void;
}

export function BannerCropDialog({ file, onClose, onCrop }: BannerCropDialogProps) {
	const [crop, setCrop] = useState<Crop>({
		unit: "%",
		width: 90,
		height: 90,
		x: 5,
		y: 5,
	});
	const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null);
	const t = useExtracted();

	const onImageLoad = useCallback((img: HTMLImageElement) => {
		setImageRef(img);
		// Calculate the initial banner crop based on image dimensions
		// Using 4:1 aspect ratio for banners (typical wide banner format)
		const width = img.width;
		const height = img.height;

		// Check if image already has the perfect 4:1 aspect ratio
		const aspectRatio = width / height;
		const targetAspectRatio = 4;
		const aspectRatioTolerance = 0.01; // 1% tolerance

		if (Math.abs(aspectRatio - targetAspectRatio) < aspectRatioTolerance) {
			// Image already has the correct aspect ratio, use full dimensions
			setCrop({
				unit: "px",
				width: width,
				height: height,
				x: 0,
				y: 0,
			});
			return;
		}

		// Calculate banner dimensions with 4:1 aspect ratio
		let cropWidth = width;
		let cropHeight = width / 4;

		// If the calculated height is bigger than the image, scale it down
		if (cropHeight > height) {
			cropHeight = height;
			cropWidth = height * 4;
		}

		const x = (width - cropWidth) / 2;
		const y = (height - cropHeight) / 2;

		setCrop({
			unit: "px",
			width: cropWidth,
			height: cropHeight,
			x,
			y,
		});
	}, []);

	const handleCrop = useCallback(async () => {
		if (!imageRef || !file) {
			return;
		}

		const canvas = document.createElement("canvas");
		const scaleX = imageRef.naturalWidth / imageRef.width;
		const scaleY = imageRef.naturalHeight / imageRef.height;

		// Set fixed output size for the cropped banner (1200x300 for 4:1 ratio)
		const outputWidth = 1200;
		const outputHeight = 300;
		canvas.width = outputWidth;
		canvas.height = outputHeight;

		const ctx = canvas.getContext("2d");
		if (!ctx) {
			return;
		}

		ctx.imageSmoothingQuality = "high";

		ctx.drawImage(
			imageRef,
			crop.x * scaleX,
			crop.y * scaleY,
			crop.width * scaleX,
			crop.height * scaleY,
			0,
			0,
			outputWidth,
			outputHeight,
		);

		canvas.toBlob(
			(blob) => {
				if (!blob) {
					return;
				}
				const croppedFile = new File([blob], file.name, {
					type: file.type,
				});
				onCrop(croppedFile);
				onClose();
			},
			file.type,
			1,
		);
	}, [crop, imageRef, file, onCrop, onClose]);

	if (!file) {
		return null;
	}

	return (
		<Dialog open={!!file} onOpenChange={onClose}>
			<DialogContent className="max-w-[800px]">
				<DialogHeader>
					<DialogTitle>{t("Crop banner image")}</DialogTitle>
					<DialogDescription>
						{t("Adjust the crop area for your banner (3:1 ratio) and click save to apply changes")}
					</DialogDescription>
				</DialogHeader>
				<div className="my-4 flex justify-center">
					<div className="max-h-[500px] w-auto">
						<ReactCrop crop={crop} onChange={(c) => setCrop(c)} aspect={4} className="max-h-[500px] w-auto">
							{/** biome-ignore lint/performance/noImgElement: Local image */}
							<img
								src={URL.createObjectURL(file)}
								alt="Crop"
								onLoad={(e) => onImageLoad(e.currentTarget)}
								className="max-h-[500px] w-auto"
							/>
						</ReactCrop>
					</div>
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						{t("Cancel")}
					</Button>
					<Button onClick={handleCrop}>{t("Save")}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
