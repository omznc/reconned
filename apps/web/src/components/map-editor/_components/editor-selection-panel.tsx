"use client";

import { Search } from "lucide-react";

import { iconNames } from "lucide-react/dynamic";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { getIconComponent, PointMarker } from "@/components/map-editor/_components/point-marker";
import type { FeatureStyle } from "@/components/map-editor/types";
import { useMapEditorStore } from "@/components/map-editor/use-map-editor-store";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type EditorSelectionPanelProps = {
	sidebarIconSize: number;
	dimmed: boolean;
};

export function EditorSelectionPanel({ sidebarIconSize, dimmed }: EditorSelectionPanelProps) {
	const t = useExtracted();
	const mapEditorStore = useMapEditorStore();
	const selectedFeature = mapEditorStore.features.find((feature) => feature.id === mapEditorStore.selectedId);
	const hasSelection = Boolean(selectedFeature);
	const appliedStyle = mapEditorStore.style;
	const [strokeColorInput, setStrokeColorInput] = useState<string>(appliedStyle.strokeColor);
	const [fillColorInput, setFillColorInput] = useState<string>(appliedStyle.fillColor);
	const [iconSizeInput, setIconSizeInput] = useState<number>(22);
	const [iconSearch, setIconSearch] = useState("");
	const strokeRafRef = useRef<number | null>(null);
	const fillRafRef = useRef<number | null>(null);

	useEffect(() => {
		if (selectedFeature) {
			setStrokeColorInput(selectedFeature.style.strokeColor);
			setFillColorInput(selectedFeature.style.fillColor);
			setIconSizeInput(selectedFeature.iconSize ?? 22);
			return;
		}
		setStrokeColorInput(appliedStyle.strokeColor);
		setFillColorInput(appliedStyle.fillColor);
		setIconSizeInput(22);
	}, [selectedFeature, appliedStyle.strokeColor, appliedStyle.fillColor]);

	const filteredIcons = (() => {
		const query = iconSearch.trim().toLowerCase();
		if (!query) {
			return iconNames.slice(0, 120);
		}
		const results: string[] = [];
		for (const name of iconNames) {
			if (name.includes(query)) {
				results.push(name);
			}
			if (results.length >= 120) {
				break;
			}
		}
		return results;
	})();

	const handleLabelChange = (value: string) => {
		if (!selectedFeature) {
			return;
		}
		mapEditorStore.updateFeature(selectedFeature.id, (feature) => ({ ...feature, label: value }));
	};

	const handleStrokeColorChange = (value: string) => {
		setStrokeColorInput(value);
		if (strokeRafRef.current) {
			cancelAnimationFrame(strokeRafRef.current);
		}
		strokeRafRef.current = requestAnimationFrame(() => {
			mapEditorStore.setStyle({ ...mapEditorStore.style, strokeColor: value });
			if (selectedFeature) {
				mapEditorStore.updateFeature(selectedFeature.id, (feature) => ({
					...feature,
					style: { ...feature.style, strokeColor: value },
				}));
			}
		});
	};

	const handleFillColorChange = (value: string) => {
		setFillColorInput(value);
		if (fillRafRef.current) {
			cancelAnimationFrame(fillRafRef.current);
		}
		fillRafRef.current = requestAnimationFrame(() => {
			mapEditorStore.setStyle({ ...mapEditorStore.style, fillColor: value });
			if (selectedFeature) {
				mapEditorStore.updateFeature(selectedFeature.id, (feature) => ({
					...feature,
					style: { ...feature.style, fillColor: value },
				}));
			}
		});
	};

	const handleStrokeWidthChange = (value: number[]) => {
		const width = value[0] ?? appliedStyle.strokeWidth;
		const nextStyle: FeatureStyle = { ...appliedStyle, strokeWidth: width };
		mapEditorStore.setStyle(nextStyle);
		if (selectedFeature) {
			mapEditorStore.updateFeature(selectedFeature.id, (feature) => ({
				...feature,
				style: { ...feature.style, strokeWidth: width },
			}));
		}
	};

	const handleFillOpacityChange = (value: number[]) => {
		const opacity = (value[0] ?? appliedStyle.fillOpacity * 100) / 100;
		const nextStyle: FeatureStyle = { ...appliedStyle, fillOpacity: opacity };
		mapEditorStore.setStyle(nextStyle);
		if (selectedFeature) {
			mapEditorStore.updateFeature(selectedFeature.id, (feature) => ({
				...feature,
				style: { ...feature.style, fillOpacity: opacity },
			}));
		}
	};

	const handleIconBackgroundChange = (checked: boolean) => {
		if (!selectedFeature) {
			return;
		}
		mapEditorStore.updateFeature(selectedFeature.id, (feature) => ({
			...feature,
			iconBackground: checked,
		}));
	};

	const handleIconSizeChange = (value: number[]) => {
		const size = value[0] ?? 22;
		setIconSizeInput(size);
		if (!selectedFeature) {
			return;
		}
		mapEditorStore.updateFeature(selectedFeature.id, (feature) => ({
			...feature,
			iconSize: size,
		}));
	};

	const handleIconSelect = (name: string) => {
		mapEditorStore.setPointIconName(name);
		setIconSearch("");
		if (!selectedFeature) {
			return;
		}
		mapEditorStore.updateFeature(selectedFeature.id, (feature) => ({
			...feature,
			iconName: name,
		}));
	};

	return (
		<Card className={cn("flex h-full w-[320px] shrink-0 flex-col", dimmed && "opacity-70")}>
			<CardHeader>
				<CardTitle>{t("Selection")}</CardTitle>
			</CardHeader>
			<CardContent className="flex-1 space-y-3 overflow-auto">
				<Input
					placeholder={t("Label")}
					value={selectedFeature?.label ?? ""}
					onChange={(event) => handleLabelChange(event.target.value)}
					disabled={!hasSelection}
				/>
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label htmlFor="stroke">{t("Stroke")}</Label>
						<Input
							id="stroke"
							type="color"
							value={strokeColorInput}
							onChange={(event) => {
								handleStrokeColorChange(event.target.value);
							}}
							className="h-9 w-20 p-1"
						/>
					</div>
					{selectedFeature?.kind !== "point" || selectedFeature?.iconBackground ? (
						<div className="flex items-center justify-between">
							<Label htmlFor="fill">{t("Fill")}</Label>
							<Input
								id="fill"
								type="color"
								value={fillColorInput}
								onChange={(event) => {
									handleFillColorChange(event.target.value);
								}}
								className="h-9 w-20 p-1"
							/>
						</div>
					) : null}
					<div className="space-y-1">
						<div className="flex items-center justify-between">
							<Label>{t("Stroke Width")}</Label>
							<span className="text-xs text-muted-foreground">
								{selectedFeature ? selectedFeature.style.strokeWidth : appliedStyle.strokeWidth}px
							</span>
						</div>
						<Slider
							min={1}
							max={12}
							value={[selectedFeature ? selectedFeature.style.strokeWidth : appliedStyle.strokeWidth]}
							onValueChange={handleStrokeWidthChange}
						/>
					</div>
					<div className="space-y-1">
						<div className="flex items-center justify-between">
							<Label>{t("Fill Opacity")}</Label>
							<span className="text-xs text-muted-foreground">
								{(selectedFeature ? selectedFeature.style.fillOpacity : appliedStyle.fillOpacity) * 100}
								%
							</span>
						</div>
						<Slider
							min={0}
							max={100}
							value={[
								Math.round(
									(selectedFeature ? selectedFeature.style.fillOpacity : appliedStyle.fillOpacity) *
										100,
								),
							]}
							onValueChange={handleFillOpacityChange}
						/>
					</div>
					{selectedFeature?.kind === "point" ? (
						<div className="space-y-3">
							<div className="flex items-center justify-between pt-1">
								<Label>{t("Icon")}</Label>
								<PointMarker
									name={selectedFeature.iconName ?? "map-pin"}
									color={selectedFeature.style.strokeColor}
									fill={
										selectedFeature.iconBackground ? selectedFeature.style.fillColor : "transparent"
									}
									background={false}
									size={sidebarIconSize}
								/>
							</div>
							<div className="flex items-center justify-between">
								<Label htmlFor="icon-bg">{t("Icon background")}</Label>
								<Switch
									id="icon-bg"
									checked={selectedFeature.iconBackground ?? true}
									onCheckedChange={handleIconBackgroundChange}
								/>
							</div>
							<div className="space-y-1">
								<div className="flex items-center justify-between">
									<Label>{t("Icon size")}</Label>
									<span className="text-xs text-muted-foreground">
										{selectedFeature.iconSize ?? iconSizeInput}px
									</span>
								</div>
								<Slider
									min={12}
									max={48}
									value={[selectedFeature.iconSize ?? iconSizeInput]}
									onValueChange={handleIconSizeChange}
								/>
							</div>
							<div className="flex items-center gap-2">
								<Input
									value={iconSearch}
									onChange={(event) => setIconSearch(event.target.value)}
									placeholder={t("Search icons")}
									className="h-9"
								/>
								<Search className="size-4 text-muted-foreground" />
							</div>
							<ScrollArea className="h-[320px] rounded-md border">
								<div className="grid grid-cols-6 gap-1 p-2">
									{filteredIcons.map((name) => {
										const IconComp = getIconComponent(name);
										const active = (selectedFeature.iconName ?? "map-pin") === name;
										const prefersDark =
											typeof window !== "undefined" &&
											window.matchMedia &&
											window.matchMedia("(prefers-color-scheme: dark)").matches;
										const iconColor = prefersDark ? "#ffffff" : "#000000";
										return (
											<button
												key={name}
												type="button"
												className={cn(
													"flex items-center justify-center rounded border px-1 py-1",
													active ? "border-primary bg-primary/10" : "border-border",
												)}
												onClick={() => handleIconSelect(name)}
											>
												<IconComp className="h-5 w-5" color={iconColor} />
											</button>
										);
									})}
								</div>
							</ScrollArea>
						</div>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}
