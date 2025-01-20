"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ReactCrop, { type Crop } from "react-image-crop";
import { useCallback, useState } from "react";
import "react-image-crop/dist/ReactCrop.css";
import { useTranslations } from "next-intl";

interface ImageCropDialogProps {
	file: File | null;
	onClose: () => void;
	onCrop: (file: File) => void;
}

export function ImageCropDialog({
	file,
	onClose,
	onCrop,
}: ImageCropDialogProps) {
	const [crop, setCrop] = useState<Crop>({
		unit: "%",
		width: 90, // slightly smaller than 100 to show edges
		height: 90,
		x: 5, // center the crop (100 - 90) / 2 = 5
		y: 5,
	});
	const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null);
	const t = useTranslations('dashboard.user.settings');

	const onImageLoad = useCallback((img: HTMLImageElement) => {
		setImageRef(img);
		// Calculate the initial square crop based on image dimensions
		const width = img.width;
		const height = img.height;
		const size = Math.min(width, height);
		const x = (width - size) / 2;
		const y = (height - size) / 2;

		setCrop({
			unit: "px",
			width: size,
			height: size,
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

		// Set fixed output size for the cropped image (e.g. 500x500)
		const outputSize = 500;
		canvas.width = outputSize;
		canvas.height = outputSize;

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
			outputSize,
			outputSize,
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
					<DialogTitle>{t('cropPhotoTitle')}</DialogTitle>
					<DialogDescription>
						{t('cropPhotoDescription')}
					</DialogDescription>
				</DialogHeader>
				<div className="my-4 flex justify-center">
					<div className="max-h-[500px] w-auto">
						<ReactCrop
							crop={crop}
							onChange={(c) => setCrop(c)}
							aspect={1}
							className="max-h-[500px] w-auto"
						>
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
						{t('cancel')}
					</Button>
					<Button onClick={handleCrop}>{t('save')}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
