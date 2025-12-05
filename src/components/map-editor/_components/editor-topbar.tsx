"use client";

import { BarChart3, Download, Grid, HelpCircle, Redo2, Text, Undo2, Upload, X } from "lucide-react";

import type { BasemapId } from "@/components/map-editor/types";
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
import { cn } from "@/lib/utils";

type BasemapOption = { id: BasemapId; label: string };

type KeybindItem = { action: string; shortcut: string };

type EditorTopbarProps = {
	t: (key: string) => string;
	modeLabel: string;
	basemap: BasemapId;
	basemapOptions: BasemapOption[];
	onBasemapChange: (value: BasemapId) => void;
	gridVisible: boolean;
	onGridToggle: (value: boolean) => void;
	gridLabelsVisible: boolean;
	onGridLabelsToggle: (value: boolean) => void;
	gridOpacity: number;
	labelOpacity: number;
	onGridOpacityChange: (value: number) => void;
	onLabelOpacityChange: (value: number) => void;
	playAreaConfirmed: boolean;
	onTogglePlayArea: () => void;
	onUndo: () => void;
	onRedo: () => void;
	onExport: () => void;
	onExportPng: () => void;
	onNewMap: () => void;
	onResetView: () => void;
	onImportClick: () => void;
	onClearSelection: () => void;
	onDeleteSelection: () => void;
	onDuplicateSelection: () => void;
	canUndo: boolean;
	canRedo: boolean;
	helpOpen: boolean;
	onHelpOpenChange: (value: boolean) => void;
	onOpenStats: () => void;
	keybinds: KeybindItem[];
	visible: boolean;
	onClose?: () => void;
	dimmed: boolean;
	isSettingPlayArea: boolean;
};

export function EditorTopbar({
	t,
	modeLabel,
	basemap,
	basemapOptions,
	onBasemapChange,
	gridVisible,
	onGridToggle,
	gridLabelsVisible,
	onGridLabelsToggle,
	gridOpacity,
	labelOpacity,
	onGridOpacityChange,
	onLabelOpacityChange,
	playAreaConfirmed,
	onTogglePlayArea,
	onUndo,
	onRedo,
	onExport,
	onExportPng,
	onNewMap,
	onResetView,
	onImportClick,
	onClearSelection,
	onDeleteSelection,
	onDuplicateSelection,
	canUndo,
	canRedo,
	helpOpen,
	onHelpOpenChange,
	onOpenStats,
	keybinds,
	visible,
	onClose,
	dimmed,
	isSettingPlayArea,
}: EditorTopbarProps) {
	const formatPercent = (value: number) => {
		return `${Math.round(value * 100)}%`;
	};

	const playAreaSelecting = isSettingPlayArea && !playAreaConfirmed;

	return (
		<div className="mb-3 flex items-center justify-between gap-3">
			<Dialog open={helpOpen} onOpenChange={onHelpOpenChange}>
				<Menubar className={cn("w-fit max-w-4xl", dimmed && "opacity-70")}>
					<MenubarMenu>
						<MenubarTrigger>{t("testMap.menubar.file")}</MenubarTrigger>
						<MenubarContent>
							<MenubarItem onClick={onNewMap}>{t("testMap.menubar.newMap")}</MenubarItem>
							<MenubarSeparator />
							<MenubarItem onClick={onExportPng} disabled={true}>
								{t("testMap.menubar.exportPng")}
							</MenubarItem>
							<MenubarItem onClick={onExport} disabled={playAreaSelecting}>
								<Download className="mr-2 size-4" />
								{t("testMap.actions.export")}
							</MenubarItem>
							<MenubarItem onClick={onImportClick}>
								<Upload className="mr-2 size-4" />
								{t("testMap.actions.import")}
							</MenubarItem>
							{onClose ? (
								<>
									<MenubarSeparator />
									<MenubarItem onClick={onClose}>{t("testMap.menubar.close")}</MenubarItem>
								</>
							) : null}
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu>
						<MenubarTrigger>{t("testMap.menubar.edit")}</MenubarTrigger>
						<MenubarContent>
							<MenubarItem onClick={onClearSelection} disabled={playAreaSelecting}>
								{t("testMap.menubar.clearSelection")}
							</MenubarItem>
							<MenubarItem onClick={onDeleteSelection} disabled={playAreaSelecting}>
								{t("testMap.menubar.deleteSelection")}
							</MenubarItem>
							<MenubarItem onClick={onDuplicateSelection} disabled={playAreaSelecting}>
								{t("testMap.menubar.duplicateSelection")}
							</MenubarItem>
							<MenubarSeparator />
							<MenubarItem onClick={onUndo} disabled={!canUndo || playAreaSelecting}>
								<Undo2 className="mr-2 size-4" />
								{t("testMap.actions.undo")}
							</MenubarItem>
							<MenubarItem onClick={onRedo} disabled={!canRedo || playAreaSelecting}>
								<Redo2 className="mr-2 size-4" />
								{t("testMap.actions.redo")}
							</MenubarItem>
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu>
						<MenubarTrigger>{t("testMap.menubar.view")}</MenubarTrigger>
						<MenubarContent className="min-w-[260px]">
							<MenubarItem onClick={onResetView} disabled={playAreaSelecting}>
								{t("testMap.menubar.resetView")}
							</MenubarItem>
							<MenubarCheckboxItem
								checked={gridVisible}
								onCheckedChange={(value) => onGridToggle(Boolean(value))}
								disabled={playAreaSelecting}
							>
								<Grid className="mr-2 size-4" />
								{t("testMap.fields.grid")}
							</MenubarCheckboxItem>
							<MenubarCheckboxItem
								checked={gridLabelsVisible}
								onCheckedChange={(value) => onGridLabelsToggle(Boolean(value))}
								disabled={playAreaSelecting}
							>
								<Text className="mr-2 size-4" />
								{t("testMap.fields.gridLabels")}
							</MenubarCheckboxItem>
							<MenubarItem asChild>
								<div className="flex flex-col gap-2 px-2 py-1.5">
									<div className="flex items-center justify-between w-full text-sm">
										<span>{t("testMap.fields.gridOpacity")}</span>
										<span className="text-xs text-muted-foreground">
											{formatPercent(gridOpacity)}
										</span>
									</div>
									<Slider
										value={[gridOpacity]}
										min={0}
										max={1}
										step={0.05}
										onValueChange={(value) => onGridOpacityChange(value[0] ?? gridOpacity)}
									/>
								</div>
							</MenubarItem>
							<MenubarItem asChild>
								<div className="flex flex-col gap-2 px-2 py-1.5">
									<div className="flex items-center justify-between w-full text-sm">
										<span>{t("testMap.fields.labelOpacity")}</span>
										<span className="text-xs text-muted-foreground">
											{formatPercent(labelOpacity)}
										</span>
									</div>
									<Slider
										value={[labelOpacity]}
										min={0}
										max={1}
										step={0.05}
										onValueChange={(value) => onLabelOpacityChange(value[0] ?? labelOpacity)}
									/>
								</div>
							</MenubarItem>
							<MenubarSeparator />
							<MenubarItem disabled className="opacity-100">
								{t("testMap.fields.basemap")}
							</MenubarItem>
							<MenubarRadioGroup value={basemap}>
								{basemapOptions.map((option) => (
									<MenubarRadioItem
										key={option.id}
										value={option.id}
										onClick={() => onBasemapChange(option.id)}
									>
										{option.label}
									</MenubarRadioItem>
								))}
							</MenubarRadioGroup>
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu>
						<MenubarTrigger>{t("testMap.menubar.stats")}</MenubarTrigger>
						<MenubarContent>
							<MenubarItem onClick={onOpenStats}>
								<BarChart3 className="mr-2 size-4" />
								{t("testMap.stats.open")}
							</MenubarItem>
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu>
						<MenubarTrigger>{t("testMap.menubar.playArea")}</MenubarTrigger>
						<MenubarContent>
							<MenubarItem onClick={onTogglePlayArea}>
								{playAreaConfirmed
									? t("testMap.actions.resetPlayArea")
									: t("testMap.actions.confirmPlayArea")}
							</MenubarItem>
						</MenubarContent>
					</MenubarMenu>
					<MenubarMenu>
						<MenubarTrigger>{t("testMap.menubar.help")}</MenubarTrigger>
						<MenubarContent>
							<DialogTrigger asChild>
								<MenubarItem>
									<HelpCircle className="mr-2 size-4" />
									{t("testMap.keybinds.open")}
								</MenubarItem>
							</DialogTrigger>
						</MenubarContent>
					</MenubarMenu>
				</Menubar>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("testMap.keybinds.title")}</DialogTitle>
						<DialogDescription>{t("testMap.keybinds.description")}</DialogDescription>
					</DialogHeader>
					<div className="grid grid-cols-2 gap-2 text-sm">
						<div className="font-semibold text-muted-foreground">
							{t("testMap.keybinds.columns.action")}
						</div>
						<div className="font-semibold text-muted-foreground text-right">
							{t("testMap.keybinds.columns.shortcut")}
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
					<span>{t("testMap.canvas.modeLabel")}</span>
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
