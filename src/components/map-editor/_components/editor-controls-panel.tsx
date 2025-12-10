"use client";

import { Circle, Copy, MousePointer2, Move3d, PencilLine, Shapes, Square, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentType } from "react";

import { PointMarker } from "@/components/map-editor/_components/point-marker";
import type { EditorMode } from "@/components/map-editor/types";
import { useMapEditorStore } from "@/components/map-editor/use-map-editor-store";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ModeButton = {
	mode: EditorMode;
	icon: ComponentType<{ className?: string }>;
	label: string;
};

type EditorControlsPanelProps = {
	onFinishDraft: () => void;
	canFinish: boolean;
	onClear: () => void;
	sidebarIconSize: number;
	dimmed: boolean;
};

export function EditorControlsPanel({
	onFinishDraft,
	canFinish,
	onClear,
	sidebarIconSize,
	dimmed,
}: EditorControlsPanelProps) {
	const t = useTranslations();
	const mapEditorStore = useMapEditorStore();
	const features = mapEditorStore.features;
	const selectedId = mapEditorStore.selectedId;
	const mode = mapEditorStore.mode;

	const modeButtons: ModeButton[] = [
		{ mode: "select", icon: MousePointer2, label: t("mapEditor.modes.select") },
		{ mode: "move", icon: Move3d, label: t("mapEditor.modes.move") },
		{ mode: "point", icon: X, label: t("mapEditor.modes.point") },
		{ mode: "line", icon: PencilLine, label: t("mapEditor.modes.line") },
		{ mode: "polygon", icon: Shapes, label: t("mapEditor.modes.polygon") },
		{ mode: "rectangle", icon: Square, label: t("mapEditor.modes.rectangle") },
		{ mode: "circle", icon: Circle, label: t("mapEditor.modes.circle") },
		{ mode: "freehand", icon: PencilLine, label: t("mapEditor.modes.freehand") },
	];

	const sortedFeatures = [...features].sort((a, b) => {
		const aLabel = a.label ?? a.kind;
		const bLabel = b.label ?? b.kind;
		if (aLabel < bLabel) {
			return -1;
		}
		if (aLabel > bLabel) {
			return 1;
		}
		return 0;
	});

	return (
		<Card className={cn("flex h-full w-[320px] shrink-0 flex-col", dimmed && "opacity-70")}>
			<CardHeader>
				<CardTitle>{t("mapEditor.controls")}</CardTitle>
			</CardHeader>
			<CardContent className="flex h-full min-h-0 flex-col space-y-4">
				<div className="grid grid-cols-2 gap-2">
					{modeButtons.map((item) => {
						const Icon = item.icon;
						const isActive = mode === item.mode;
						return (
							<Button
								key={item.mode}
								variant={isActive ? "default" : "outline"}
								size="sm"
								className="justify-start gap-2"
								onClick={() => mapEditorStore.setMode(item.mode)}
							>
								<Icon className="size-4" />
								{item.label}
							</Button>
						);
					})}
				</div>
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<span className="font-semibold text-sm">{t("mapEditor.actions.title")}</span>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button variant="secondary" size="sm" onClick={onFinishDraft} disabled={!canFinish}>
							{t("mapEditor.actions.finish")}
						</Button>
						<Button variant="destructive" size="sm" onClick={onClear}>
							{t("mapEditor.actions.clear")}
						</Button>
					</div>
				</div>
				<div className="flex min-h-0 flex-1 flex-col gap-2">
					<div className="flex items-center justify-between">
						<span className="font-semibold text-sm">{t("mapEditor.fields.features")}</span>
						<span className="text-xs text-muted-foreground">{features.length}</span>
					</div>
					{features.length > 0 ? (
						<ScrollArea className="flex-1 min-h-0 rounded-md border">
							<div className="p-2 grid grid-cols-1 gap-2">
								{sortedFeatures.map((feature) => {
									const isActive = feature.id === selectedId;
									const icon = feature.kind === "point" ? (feature.iconName ?? "map-pin") : undefined;
									const size = sidebarIconSize;
									return (
										<button
											key={feature.id}
											type="button"
											className={cn(
												"w-full rounded-md border px-3 py-2 text-left",
												isActive
													? "border-primary bg-primary/10"
													: "border-border bg-background",
											)}
											onClick={() => mapEditorStore.setSelectedId(feature.id)}
										>
											<div className="flex items-center gap-2">
												{icon ? (
													<PointMarker
														name={icon}
														color={feature.style.strokeColor}
														fill={
															feature.iconBackground
																? feature.style.fillColor
																: "transparent"
														}
														background={false}
														size={size}
														scale={1}
													/>
												) : (
													<Shapes className="h-4 w-4 text-muted-foreground" />
												)}
												<div className="flex-1">
													<div className="text-sm font-semibold capitalize truncate">
														{feature.label || feature.kind}
													</div>
													<div className="text-xs text-muted-foreground capitalize">
														{feature.kind}
													</div>
												</div>
												<div className="flex items-center gap-1">
													<button
														type="button"
														className="rounded p-1 text-muted-foreground hover:text-primary"
														onClick={(event) => {
															event.stopPropagation();
															mapEditorStore.setSelectedId(feature.id);
															mapEditorStore.duplicateSelected();
														}}
													>
														<Copy className="h-4 w-4" />
													</button>
													<button
														type="button"
														className="rounded p-1 text-muted-foreground hover:text-destructive"
														onClick={(event) => {
															event.stopPropagation();
															mapEditorStore.deleteFeature(feature.id);
														}}
													>
														<Trash2 className="h-4 w-4" />
													</button>
												</div>
											</div>
										</button>
									);
								})}
							</div>
						</ScrollArea>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}
