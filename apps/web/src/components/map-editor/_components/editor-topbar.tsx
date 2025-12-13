"use client";

import { BarChart3, Download, Grid, HelpCircle, Redo2, Text, Undo2, Upload, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";

import type { BasemapId } from "@/components/map-editor/types";
import { useMapEditorStore } from "@/components/map-editor/use-map-editor-store";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Menubar,
	MenubarCheckboxItem,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarRadioGroup,
	MenubarRadioItem,
	MenubarSeparator,
	MenubarTrigger,
} from "@/components/ui/menubar";
import { Slider } from "@/components/ui/slider";

type BasemapOption = { id: BasemapId; label: string };

type KeybindItem = { action: string; shortcut: string };

type EditorTopbarProps = {
	onExport: () => void;
	onExportPng: () => void;
	onNewMap: () => void;
	onResetView: () => void;
	onImportClick: () => void;
	onTogglePlayArea: () => void;
	playAreaConfirmed: boolean;
	onOpenStats: () => void;
	visible: boolean;
	onClose?: () => void;
	isSettingPlayArea: boolean;
};

export function EditorTopbar({
	onExport,
	onExportPng,
	onNewMap,
	onResetView,
	onImportClick,
	onTogglePlayArea,
	playAreaConfirmed,
	onOpenStats,
	visible,
	onClose,
	isSettingPlayArea,
}: EditorTopbarProps) {
	const t = useExtracted();
	const mapEditorStore = useMapEditorStore();
	const [helpOpen, setHelpOpen] = useState(false);
	const formatPercent = (value: number) => {
		return `${Math.round(value * 100)}%`;
	};

	const playAreaSelecting = isSettingPlayArea && !playAreaConfirmed;

	const basemapOptions: BasemapOption[] = [
		{ id: "osm", label: t("Street") },
		{ id: "satellite", label: t("Satellite") },
	];

	const keybinds: KeybindItem[] = [
		{
			action: t("Undo"),
			shortcut: t("Ctrl/Cmd + Z"),
		},
		{
			action: t("Redo"),
			shortcut: t("Ctrl/Cmd + Shift + Z"),
		},
		{
			action: t("Delete selection"),
			shortcut: t("Delete / Backspace"),
		},
		{
			action: t("Duplicate selection"),
			shortcut: t("Ctrl/Cmd + D"),
		},
		{
			action: t("Finish shape"),
			shortcut: t("Enter"),
		},
		{
			action: t("Cancel draft"),
			shortcut: t("Esc"),
		},
		{
			action: t("Move selection"),
			shortcut: t("Ctrl + Drag"),
		},
		{
			action: t("Temp move mode"),
			shortcut: t("Middle drag / Ctrl/Cmd + Drag"),
		},
		{
			action: t("Add vertex on edge"),
			shortcut: t("Click midpoint handle"),
		},
		{
			action: t("Delete vertex"),
			shortcut: t("Shift + Click vertex handle"),
		},
		{
			action: t("Resize shapes"),
			shortcut: t("Drag shape handles"),
		},
	];

	const modeLabel = (() => {
		const mode = mapEditorStore.mode;
		if (mode === "select") {
			return t("Select");
		}
		if (mode === "move") {
			return t("Move");
		}
		if (mode === "point") {
			return t("Point");
		}
		if (mode === "line") {
			return t("Line");
		}
		if (mode === "polygon") {
			return t("Polygon");
		}
		if (mode === "rectangle") {
			return t("Rectangle");
		}
		if (mode === "circle") {
			return t("Circle");
		}
		return t("Freehand");
	})();

	const canUndo = mapEditorStore.history.length > 0;
	const canRedo = mapEditorStore.future.length > 0;

	const handleClearSelection = () => {
		mapEditorStore.setSelectedId(undefined);
	};

	const handleDeleteSelection = () => {
		if (!mapEditorStore.selectedId) {
			return;
		}
		mapEditorStore.deleteFeature(mapEditorStore.selectedId);
	};

	const handleDuplicateSelection = () => {
		if (!mapEditorStore.selectedId) {
			return;
		}
		mapEditorStore.duplicateSelected();
	};

	return (
		<div className="mb-3 flex items-center justify-between gap-3">
			<Dialog open={helpOpen} onOpenChange={setHelpOpen}>
				<Menubar className="w-fit max-w-4xl">
					<MenubarMenu>
						<MenubarTrigger>{t("File")}</MenubarTrigger>
						<MenubarContent>
							<MenubarItem onClick={onNewMap}>{t("New map")}</MenubarItem>
							<MenubarSeparator />
							<MenubarItem onClick={onExportPng} disabled={true}>
								{t("Export PNG")}
							</MenubarItem>
							<MenubarItem onClick={onExport} disabled={playAreaSelecting}>
								<Download className="mr-2 size-4" />
								{t("Export JSON")}
							</MenubarItem>
							<MenubarItem onClick={onImportClick}>
								<Upload className="mr-2 size-4" />
								{t("Import JSON")}
							</MenubarItem>
							{onClose ? (
								<>
									<MenubarSeparator />
									<MenubarItem onClick={onClose}>{t("Close")}</MenubarItem>
								</>
							) : null}
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu>
						<MenubarTrigger>{t("Edit")}</MenubarTrigger>
						<MenubarContent>
							<MenubarItem
								onSelect={(event) => {
									event.preventDefault();
									handleClearSelection();
								}}
								disabled={playAreaSelecting}
							>
								{t("Clear selection")}
							</MenubarItem>
							<MenubarItem
								onSelect={(event) => {
									event.preventDefault();
									handleDeleteSelection();
								}}
								disabled={playAreaSelecting}
							>
								{t("Delete selection")}
							</MenubarItem>
							<MenubarItem
								onSelect={(event) => {
									event.preventDefault();
									handleDuplicateSelection();
								}}
								disabled={playAreaSelecting}
							>
								{t("Duplicate selection")}
							</MenubarItem>
							<MenubarSeparator />
							<MenubarItem
								onSelect={(event) => {
									event.preventDefault();
									mapEditorStore.undo();
								}}
								disabled={!canUndo || playAreaSelecting}
							>
								<Undo2 className="mr-2 size-4" />
								{t("Undo")}
							</MenubarItem>
							<MenubarItem
								onSelect={(event) => {
									event.preventDefault();
									mapEditorStore.redo();
								}}
								disabled={!canRedo || playAreaSelecting}
							>
								<Redo2 className="mr-2 size-4" />
								{t("Redo")}
							</MenubarItem>
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu>
						<MenubarTrigger>{t("View")}</MenubarTrigger>
						<MenubarContent className="min-w-[260px]">
							<MenubarItem
								onSelect={(event) => {
									event.preventDefault();
									onResetView();
								}}
								disabled={playAreaSelecting}
							>
								{t("Reset view to play area")}
							</MenubarItem>
							<MenubarCheckboxItem
								checked={mapEditorStore.gridVisible}
								onSelect={(event) => {
									event.preventDefault();
								}}
								onCheckedChange={(value) => mapEditorStore.setGridVisible(Boolean(value))}
								disabled={playAreaSelecting}
							>
								<Grid className="mr-2 size-4" />
								{t("Grid")}
							</MenubarCheckboxItem>
							<MenubarCheckboxItem
								checked={mapEditorStore.gridLabelsVisible}
								onSelect={(event) => {
									event.preventDefault();
								}}
								onCheckedChange={(value) => mapEditorStore.setGridLabelsVisible(Boolean(value))}
								disabled={playAreaSelecting}
							>
								<Text className="mr-2 size-4" />
								{t("Grid labels")}
							</MenubarCheckboxItem>
							<MenubarItem
								asChild
								onSelect={(event) => {
									event.preventDefault();
								}}
							>
								<div className="flex flex-col gap-2 px-2 py-1.5">
									<div className="flex items-center justify-between w-full text-sm">
										<span>{t("Grid opacity")}</span>
										<span className="text-xs text-muted-foreground">
											{formatPercent(mapEditorStore.gridOpacity)}
										</span>
									</div>
									<Slider
										value={[mapEditorStore.gridOpacity]}
										min={0}
										max={1}
										step={0.05}
										onValueChange={(value) =>
											mapEditorStore.setGridOpacity(value[0] ?? mapEditorStore.gridOpacity)
										}
									/>
								</div>
							</MenubarItem>
							<MenubarItem
								asChild
								onSelect={(event) => {
									event.preventDefault();
								}}
							>
								<div className="flex flex-col gap-2 px-2 py-1.5">
									<div className="flex items-center justify-between w-full text-sm">
										<span>{t("Label opacity")}</span>
										<span className="text-xs text-muted-foreground">
											{formatPercent(mapEditorStore.labelOpacity)}
										</span>
									</div>
									<Slider
										value={[mapEditorStore.labelOpacity]}
										min={0}
										max={1}
										step={0.05}
										onValueChange={(value) =>
											mapEditorStore.setLabelOpacity(value[0] ?? mapEditorStore.labelOpacity)
										}
									/>
								</div>
							</MenubarItem>
							<MenubarSeparator />
							<MenubarItem disabled className="opacity-100">
								{t("Basemap")}
							</MenubarItem>
							<MenubarRadioGroup value={mapEditorStore.basemap}>
								{basemapOptions.map((option) => (
									<MenubarRadioItem
										key={option.id}
										value={option.id}
										onSelect={(event) => {
											event.preventDefault();
											mapEditorStore.setBasemap(option.id);
										}}
									>
										{option.label}
									</MenubarRadioItem>
								))}
							</MenubarRadioGroup>
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu>
						<MenubarTrigger>{t("Stats")}</MenubarTrigger>
						<MenubarContent>
							<MenubarItem onClick={onOpenStats}>
								<BarChart3 className="mr-2 size-4" />
								{t("Open stats")}
							</MenubarItem>
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu>
						<MenubarTrigger>{t("Play area")}</MenubarTrigger>
						<MenubarContent>
							<MenubarItem onClick={onTogglePlayArea}>
								{playAreaConfirmed ? t("Edit area") : t("Confirm area")}
							</MenubarItem>
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu>
						<MenubarTrigger>{t("Help")}</MenubarTrigger>
						<MenubarContent>
							<DialogTrigger asChild>
								<MenubarItem>
									<HelpCircle className="mr-2 size-4" />
									{t("Keybinds")}
								</MenubarItem>
							</DialogTrigger>
						</MenubarContent>
					</MenubarMenu>
				</Menubar>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("Keyboard shortcuts")}</DialogTitle>
						<DialogDescription>{t("Keyboard shortcuts available in the editor.")}</DialogDescription>
					</DialogHeader>
					<div className="grid grid-cols-2 gap-2 text-sm">
						<div className="font-semibold text-muted-foreground">{t("Action")}</div>
						<div className="font-semibold text-muted-foreground text-right">{t("Shortcut")}</div>
						{keybinds.map((item) => (
							<div key={`${item.action}-${item.shortcut}`} className="col-span-2 grid grid-cols-2 gap-2">
								<span className="truncate">{item.action}</span>
								<span className="text-right font-mono text-xs">{item.shortcut}</span>
							</div>
						))}
					</div>
				</DialogContent>
			</Dialog>
			<div className="flex items-center gap-2">
				<div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm bg-sidebar">
					<span>{t("Mode:")}</span>
					<span className="font-semibold capitalize">{modeLabel}</span>
				</div>
				{visible ? (
					<Button type="button" variant="default" size="sm" onClick={onClose}>
						<X className="size-5" />
					</Button>
				) : null}
			</div>
		</div>
	);
}
