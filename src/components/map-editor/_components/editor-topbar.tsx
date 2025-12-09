"use client";

import { BarChart3, Download, Grid, HelpCircle, Redo2, Text, Undo2, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
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
	const t = useTranslations();
	const mapEditorStore = useMapEditorStore();
	const [helpOpen, setHelpOpen] = useState(false);
	const formatPercent = (value: number) => {
		return `${Math.round(value * 100)}%`;
	};

	const playAreaSelecting = isSettingPlayArea && !playAreaConfirmed;

	const basemapOptions: BasemapOption[] = [
		{ id: "osm", label: t("mapEditor.basemap.osm") },
		{ id: "satellite", label: t("mapEditor.basemap.satellite") },
	];

	const keybinds: KeybindItem[] = [
		{
			action: t("mapEditor.keybinds.items.undo.action"),
			shortcut: t("mapEditor.keybinds.items.undo.shortcut"),
		},
		{
			action: t("mapEditor.keybinds.items.redo.action"),
			shortcut: t("mapEditor.keybinds.items.redo.shortcut"),
		},
		{
			action: t("mapEditor.keybinds.items.delete.action"),
			shortcut: t("mapEditor.keybinds.items.delete.shortcut"),
		},
		{
			action: t("mapEditor.keybinds.items.duplicate.action"),
			shortcut: t("mapEditor.keybinds.items.duplicate.shortcut"),
		},
		{
			action: t("mapEditor.keybinds.items.finish.action"),
			shortcut: t("mapEditor.keybinds.items.finish.shortcut"),
		},
		{
			action: t("mapEditor.keybinds.items.cancel.action"),
			shortcut: t("mapEditor.keybinds.items.cancel.shortcut"),
		},
		{
			action: t("mapEditor.keybinds.items.shiftDrag.action"),
			shortcut: t("mapEditor.keybinds.items.shiftDrag.shortcut"),
		},
		{
			action: t("mapEditor.keybinds.items.moveOverride.action"),
			shortcut: t("mapEditor.keybinds.items.moveOverride.shortcut"),
		},
		{
			action: t("mapEditor.keybinds.items.insertMidpoint.action"),
			shortcut: t("mapEditor.keybinds.items.insertMidpoint.shortcut"),
		},
		{
			action: t("mapEditor.keybinds.items.deleteVertex.action"),
			shortcut: t("mapEditor.keybinds.items.deleteVertex.shortcut"),
		},
		{
			action: t("mapEditor.keybinds.items.resizeHandles.action"),
			shortcut: t("mapEditor.keybinds.items.resizeHandles.shortcut"),
		},
	];

	const modeLabel = (() => {
		const mode = mapEditorStore.mode;
		if (mode === "select") {
			return t("mapEditor.modes.select");
		}
		if (mode === "move") {
			return t("mapEditor.modes.move");
		}
		if (mode === "point") {
			return t("mapEditor.modes.point");
		}
		if (mode === "line") {
			return t("mapEditor.modes.line");
		}
		if (mode === "polygon") {
			return t("mapEditor.modes.polygon");
		}
		if (mode === "rectangle") {
			return t("mapEditor.modes.rectangle");
		}
		if (mode === "circle") {
			return t("mapEditor.modes.circle");
		}
		return t("mapEditor.modes.freehand");
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
						<MenubarTrigger>{t("mapEditor.menubar.file")}</MenubarTrigger>
						<MenubarContent>
							<MenubarItem onClick={onNewMap}>{t("mapEditor.menubar.newMap")}</MenubarItem>
							<MenubarSeparator />
							<MenubarItem onClick={onExportPng} disabled={true}>
								{t("mapEditor.menubar.exportPng")}
							</MenubarItem>
							<MenubarItem onClick={onExport} disabled={playAreaSelecting}>
								<Download className="mr-2 size-4" />
								{t("mapEditor.actions.export")}
							</MenubarItem>
							<MenubarItem onClick={onImportClick}>
								<Upload className="mr-2 size-4" />
								{t("mapEditor.actions.import")}
							</MenubarItem>
							{onClose ? (
								<>
									<MenubarSeparator />
									<MenubarItem onClick={onClose}>{t("mapEditor.menubar.close")}</MenubarItem>
								</>
							) : null}
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu>
						<MenubarTrigger>{t("mapEditor.menubar.edit")}</MenubarTrigger>
						<MenubarContent>
							<MenubarItem
								onSelect={(event) => {
									event.preventDefault();
									handleClearSelection();
								}}
								disabled={playAreaSelecting}
							>
								{t("mapEditor.menubar.clearSelection")}
							</MenubarItem>
							<MenubarItem
								onSelect={(event) => {
									event.preventDefault();
									handleDeleteSelection();
								}}
								disabled={playAreaSelecting}
							>
								{t("mapEditor.menubar.deleteSelection")}
							</MenubarItem>
							<MenubarItem
								onSelect={(event) => {
									event.preventDefault();
									handleDuplicateSelection();
								}}
								disabled={playAreaSelecting}
							>
								{t("mapEditor.menubar.duplicateSelection")}
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
								{t("mapEditor.actions.undo")}
							</MenubarItem>
							<MenubarItem
								onSelect={(event) => {
									event.preventDefault();
									mapEditorStore.redo();
								}}
								disabled={!canRedo || playAreaSelecting}
							>
								<Redo2 className="mr-2 size-4" />
								{t("mapEditor.actions.redo")}
							</MenubarItem>
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu>
						<MenubarTrigger>{t("mapEditor.menubar.view")}</MenubarTrigger>
						<MenubarContent className="min-w-[260px]">
							<MenubarItem
								onSelect={(event) => {
									event.preventDefault();
									onResetView();
								}}
								disabled={playAreaSelecting}
							>
								{t("mapEditor.menubar.resetView")}
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
								{t("mapEditor.fields.grid")}
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
								{t("mapEditor.fields.gridLabels")}
							</MenubarCheckboxItem>
							<MenubarItem
								asChild
								onSelect={(event) => {
									event.preventDefault();
								}}
							>
								<div className="flex flex-col gap-2 px-2 py-1.5">
									<div className="flex items-center justify-between w-full text-sm">
										<span>{t("mapEditor.fields.gridOpacity")}</span>
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
										<span>{t("mapEditor.fields.labelOpacity")}</span>
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
								{t("mapEditor.fields.basemap")}
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
						<MenubarTrigger>{t("mapEditor.menubar.stats")}</MenubarTrigger>
						<MenubarContent>
							<MenubarItem onClick={onOpenStats}>
								<BarChart3 className="mr-2 size-4" />
								{t("mapEditor.stats.open")}
							</MenubarItem>
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu>
						<MenubarTrigger>{t("mapEditor.menubar.playArea")}</MenubarTrigger>
						<MenubarContent>
							<MenubarItem onClick={onTogglePlayArea}>
								{playAreaConfirmed
									? t("mapEditor.actions.resetPlayArea")
									: t("mapEditor.actions.confirmPlayArea")}
							</MenubarItem>
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu>
						<MenubarTrigger>{t("mapEditor.menubar.help")}</MenubarTrigger>
						<MenubarContent>
							<DialogTrigger asChild>
								<MenubarItem>
									<HelpCircle className="mr-2 size-4" />
									{t("mapEditor.keybinds.open")}
								</MenubarItem>
							</DialogTrigger>
						</MenubarContent>
					</MenubarMenu>
				</Menubar>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("mapEditor.keybinds.title")}</DialogTitle>
						<DialogDescription>{t("mapEditor.keybinds.description")}</DialogDescription>
					</DialogHeader>
					<div className="grid grid-cols-2 gap-2 text-sm">
						<div className="font-semibold text-muted-foreground">
							{t("mapEditor.keybinds.columns.action")}
						</div>
						<div className="font-semibold text-muted-foreground text-right">
							{t("mapEditor.keybinds.columns.shortcut")}
						</div>
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
					<span>{t("mapEditor.canvas.modeLabel")}</span>
					<span className="font-semibold capitalize">{modeLabel}</span>
				</div>
				{visible ? (
					<Button variant="default" size="sm" onClick={onClose}>
						<X className="size-5" />
					</Button>
				) : null}
			</div>
		</div>
	);
}
