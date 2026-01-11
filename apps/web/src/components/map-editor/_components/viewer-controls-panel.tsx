"use client";

import { ChevronDown, ChevronUp, Eye, Grid, MapIcon, Text } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";

import type { BasemapId } from "@/components/map-editor/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type ViewerControlsPanelProps = {
	gridVisible: boolean;
	onGridVisibleChange: (value: boolean) => void;
	gridLabelsVisible: boolean;
	onGridLabelsVisibleChange: (value: boolean) => void;
	gridOpacity: number;
	onGridOpacityChange: (value: number) => void;
	labelOpacity: number;
	onLabelOpacityChange: (value: number) => void;
	basemap: BasemapId;
	onBasemapChange: (value: BasemapId) => void;
	className?: string;
};

export function ViewerControlsPanel({
	gridVisible,
	onGridVisibleChange,
	gridLabelsVisible,
	onGridLabelsVisibleChange,
	gridOpacity,
	onGridOpacityChange,
	labelOpacity,
	onLabelOpacityChange,
	basemap,
	onBasemapChange,
	className,
}: ViewerControlsPanelProps) {
	const t = useExtracted();
	const [isExpanded, setIsExpanded] = useState(false);
	const [shouldShowContent, setShouldShowContent] = useState(false);

	const formatPercent = (value: number) => {
		return `${Math.round(value * 100)}%`;
	};

	const handleToggle = () => {
		if (!isExpanded) {
			// Opening: expand width immediately, then show content
			setIsExpanded(true);
			setTimeout(() => setShouldShowContent(true), 50);
		} else {
			// Closing: hide content first, then collapse width
			setShouldShowContent(false);
			setTimeout(() => setIsExpanded(false), 200);
		}
	};

	return (
		<div className={cn("absolute top-2 right-2 sm:top-4 sm:right-4 z-10", className)}>
			<div
				className={cn(
					"rounded-lg border bg-background/95 backdrop-blur shadow-lg overflow-hidden max-w-[calc(100vw-1rem)] sm:max-w-none transition-[width] ease-in-out",
					isExpanded ? "w-[280px] sm:w-[300px] duration-200" : "w-auto duration-200 delay-200",
				)}
			>
				{/* Header - Always visible */}
				<button
					type="button"
					onClick={handleToggle}
					className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 hover:bg-accent/50 transition-colors whitespace-nowrap"
				>
					<div className="flex items-center gap-1.5 sm:gap-2">
						<Eye className="size-3.5 sm:size-4" />
						<span className="text-xs sm:text-sm font-medium">{t("View Controls")}</span>
					</div>
					{isExpanded ? (
						<ChevronUp className="size-3.5 sm:size-4" />
					) : (
						<ChevronDown className="size-3.5 sm:size-4" />
					)}
				</button>

				{/* Expandable content */}
				<div
					className={cn(
						"border-t overflow-hidden transition-all duration-200 ease-out",
						shouldShowContent ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 border-t-0",
					)}
				>
					<div className="p-2.5 sm:p-3 space-y-2.5 sm:space-y-3">
						{/* Grid toggle */}
						<div className="flex items-center justify-between gap-2">
							<Label
								htmlFor="grid-visible"
								className="flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer"
							>
								<Grid className="size-3.5 sm:size-4" />
								{t("Grid")}
							</Label>
							<Switch id="grid-visible" checked={gridVisible} onCheckedChange={onGridVisibleChange} />
						</div>

						{/* Grid labels toggle */}
						<div className="flex items-center justify-between gap-2">
							<Label
								htmlFor="grid-labels"
								className="flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer"
							>
								<Text className="size-3.5 sm:size-4" />
								{t("Grid labels")}
							</Label>
							<Switch
								id="grid-labels"
								checked={gridLabelsVisible}
								onCheckedChange={onGridLabelsVisibleChange}
							/>
						</div>

						{/* Grid opacity */}
						<div className="space-y-1">
							<div className="flex items-center justify-between">
								<Label className="text-xs sm:text-sm">{t("Grid opacity")}</Label>
								<span className="text-[10px] sm:text-xs text-muted-foreground tabular-nums">
									{formatPercent(gridOpacity)}
								</span>
							</div>
							<Slider
								value={[gridOpacity]}
								min={0}
								max={1}
								step={0.05}
								onValueChange={(value) => onGridOpacityChange(value[0] || gridOpacity)}
								className="w-full"
							/>
						</div>

						{/* Label opacity */}
						<div className="space-y-1">
							<div className="flex items-center justify-between">
								<Label className="text-xs sm:text-sm">{t("Label opacity")}</Label>
								<span className="text-[10px] sm:text-xs text-muted-foreground tabular-nums">
									{formatPercent(labelOpacity)}
								</span>
							</div>
							<Slider
								value={[labelOpacity]}
								min={0}
								max={1}
								step={0.05}
								onValueChange={(value) => onLabelOpacityChange(value[0] || labelOpacity)}
								className="w-full"
							/>
						</div>

						{/* Basemap selector */}
						<div className="space-y-1 pt-0.5">
							<Label className="text-xs sm:text-sm flex items-center gap-1.5">
								<MapIcon className="size-3.5 sm:size-4" />
								{t("Basemap")}
							</Label>
							<div className="grid grid-cols-2 gap-1.5 sm:gap-2">
								<Button
									type="button"
									variant={basemap === "osm" ? "default" : "outline"}
									size="sm"
									onClick={() => onBasemapChange("osm")}
									className="text-[11px] sm:text-xs h-7 sm:h-8"
								>
									{t("Street")}
								</Button>
								<Button
									type="button"
									variant={basemap === "satellite" ? "default" : "outline"}
									size="sm"
									onClick={() => onBasemapChange("satellite")}
									className="text-[11px] sm:text-xs h-7 sm:h-8"
								>
									{t("Satellite")}
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
