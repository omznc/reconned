"use client";

import { Search } from "lucide-react";

import { getIconComponent, PointMarker } from "@/components/map-editor/_components/point-marker";
import type { FeatureStyle, MapFeature } from "@/components/map-editor/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type EditorSelectionPanelProps = {
	t: (key: string) => string;
	selectedFeature?: MapFeature;
	hasSelection: boolean;
	strokeColorInput: string;
	fillColorInput: string;
	appliedStyle: FeatureStyle;
	iconSizeInput: number;
	iconSearch: string;
	filteredIcons: string[];
	sidebarIconSize: number;
	onLabelChange: (value: string) => void;
	onStrokeColorChange: (value: string) => void;
	onFillColorChange: (value: string) => void;
	onStrokeWidthChange: (value: number[]) => void;
	onFillOpacityChange: (value: number[]) => void;
	onIconBackgroundChange: (checked: boolean) => void;
	onIconSizeChange: (value: number[]) => void;
	onIconSearchChange: (value: string) => void;
	onIconSelect: (name: string) => void;
	dimmed: boolean;
};

export function EditorSelectionPanel({
	t,
	selectedFeature,
	hasSelection,
	strokeColorInput,
	fillColorInput,
	appliedStyle,
	iconSizeInput,
	iconSearch,
	filteredIcons,
	sidebarIconSize,
	onLabelChange,
	onStrokeColorChange,
	onFillColorChange,
	onStrokeWidthChange,
	onFillOpacityChange,
	onIconBackgroundChange,
	onIconSizeChange,
	onIconSearchChange,
	onIconSelect,
	dimmed,
}: EditorSelectionPanelProps) {
	return (
		<Card className={cn("flex h-full w-[320px] shrink-0 flex-col", dimmed && "opacity-70")}>
			<CardHeader>
				<CardTitle>{t("testMap.fields.selection")}</CardTitle>
			</CardHeader>
			<CardContent className="flex-1 space-y-3 overflow-auto">
				<Input
					placeholder={t("testMap.fields.label")}
					value={selectedFeature?.label ?? ""}
					onChange={(event) => onLabelChange(event.target.value)}
					disabled={!hasSelection}
				/>
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label htmlFor="stroke">{t("testMap.fields.stroke")}</Label>
						<Input
							id="stroke"
							type="color"
							value={strokeColorInput}
							onChange={(event) => {
								onStrokeColorChange(event.target.value);
							}}
							className="h-9 w-20 p-1"
						/>
					</div>
					{selectedFeature?.kind !== "point" || selectedFeature?.iconBackground ? (
						<div className="flex items-center justify-between">
							<Label htmlFor="fill">{t("testMap.fields.fill")}</Label>
							<Input
								id="fill"
								type="color"
								value={fillColorInput}
								onChange={(event) => {
									onFillColorChange(event.target.value);
								}}
								className="h-9 w-20 p-1"
							/>
						</div>
					) : null}
					<div className="space-y-1">
						<div className="flex items-center justify-between">
							<Label>{t("testMap.fields.strokeWidth")}</Label>
							<span className="text-xs text-muted-foreground">
								{selectedFeature ? selectedFeature.style.strokeWidth : appliedStyle.strokeWidth}px
							</span>
						</div>
						<Slider
							min={1}
							max={12}
							value={[selectedFeature ? selectedFeature.style.strokeWidth : appliedStyle.strokeWidth]}
							onValueChange={onStrokeWidthChange}
						/>
					</div>
					<div className="space-y-1">
						<div className="flex items-center justify-between">
							<Label>{t("testMap.fields.fillOpacity")}</Label>
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
							onValueChange={onFillOpacityChange}
						/>
					</div>
					{selectedFeature?.kind === "point" ? (
						<div className="space-y-3">
							<div className="flex items-center justify-between pt-1">
								<Label>{t("testMap.fields.icon")}</Label>
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
								<Label htmlFor="icon-bg">{t("testMap.fields.iconBackground")}</Label>
								<Switch
									id="icon-bg"
									checked={selectedFeature.iconBackground ?? true}
									onCheckedChange={onIconBackgroundChange}
								/>
							</div>
							<div className="space-y-1">
								<div className="flex items-center justify-between">
									<Label>{t("testMap.fields.iconSize")}</Label>
									<span className="text-xs text-muted-foreground">
										{selectedFeature.iconSize ?? iconSizeInput}px
									</span>
								</div>
								<Slider
									min={12}
									max={48}
									value={[selectedFeature.iconSize ?? iconSizeInput]}
									onValueChange={onIconSizeChange}
								/>
							</div>
							<div className="flex items-center gap-2">
								<Input
									value={iconSearch}
									onChange={(event) => onIconSearchChange(event.target.value)}
									placeholder={t("testMap.fields.searchIcon")}
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
												className={`flex items-center justify-center rounded border px-1 py-1 ${
													active ? "border-primary bg-primary/10" : "border-border"
												}`}
												onClick={() => onIconSelect(name)}
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
