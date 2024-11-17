import {
	Check,
	ChevronDown,
	Heading1,
	Heading2,
	Heading3,
	TextQuote,
	ListOrdered,
	TextIcon,
	Code,
	CheckSquare,
	type LucideIcon,
} from "lucide-react";
import { EditorBubbleItem, type EditorInstance, useEditor } from "novel";

import { Popover } from "@radix-ui/react-popover";
import { PopoverContent, PopoverTrigger } from "@/components//ui/popover";
import { Button } from "@/components/ui/button";

export type SelectorItem = {
	name: string;
	icon: LucideIcon;
	command: (editor: EditorInstance) => void;
	isActive: (editor: EditorInstance) => boolean;
};

const items: SelectorItem[] = [
	{
		name: "Tekst",
		icon: TextIcon,
		command: (editor) => editor.chain().focus().clearNodes().run(),
		// I feel like there has to be a more efficient way to do this – feel free to PR if you know how!
		isActive: (editor) =>
			editor.isActive("paragraph") &&
			!editor.isActive("bulletList") &&
			!editor.isActive("orderedList"),
	},
	{
		name: "Naslov 1",
		icon: Heading1,
		command: (editor) =>
			editor.chain().focus().clearNodes().toggleHeading({ level: 1 }).run(),
		isActive: (editor) => editor.isActive("heading", { level: 1 }),
	},
	{
		name: "Naslov 2",
		icon: Heading2,
		command: (editor) =>
			editor.chain().focus().clearNodes().toggleHeading({ level: 2 }).run(),
		isActive: (editor) => editor.isActive("heading", { level: 2 }),
	},
	{
		name: "Naslov 3",
		icon: Heading3,
		command: (editor) =>
			editor.chain().focus().clearNodes().toggleHeading({ level: 3 }).run(),
		isActive: (editor) => editor.isActive("heading", { level: 3 }),
	},
	{
		name: "Lista zadataka",
		icon: CheckSquare,
		command: (editor) =>
			editor.chain().focus().clearNodes().toggleTaskList().run(),
		isActive: (editor) => editor.isActive("taskItem"),
	},
	{
		name: "Lista sa tačkama",
		icon: ListOrdered,
		command: (editor) =>
			editor.chain().focus().clearNodes().toggleBulletList().run(),
		isActive: (editor) => editor.isActive("bulletList"),
	},
	{
		name: "Numerisana lista",
		icon: ListOrdered,
		command: (editor) =>
			editor.chain().focus().clearNodes().toggleOrderedList().run(),
		isActive: (editor) => editor.isActive("orderedList"),
	},
	{
		name: "Citat",
		icon: TextQuote,
		command: (editor) =>
			editor.chain().focus().clearNodes().toggleBlockquote().run(),
		isActive: (editor) => editor.isActive("blockquote"),
	},
	{
		name: "Kod",
		icon: Code,
		command: (editor) =>
			editor.chain().focus().clearNodes().toggleCodeBlock().run(),
		isActive: (editor) => editor.isActive("codeBlock"),
	},
];
interface NodeSelectorProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const NodeSelector = ({ open, onOpenChange }: NodeSelectorProps) => {
	const { editor } = useEditor();
	if (!editor) {
		return null;
	}

	const activeItem = items.filter((item) => item.isActive(editor)).pop() ?? {
		name: "Više opcija",
	};

	return (
		<Popover modal={true} open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger
				asChild
				className="gap-2 rounded-none border-none hover:bg-accent focus:ring-0"
			>
				<Button type="button" size="sm" variant="ghost" className="gap-2">
					<span className="whitespace-nowrap text-sm">{activeItem.name}</span>
					<ChevronDown className="h-4 w-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent sideOffset={5} align="start" className="w-48 p-1">
				{items.map((item, index) => (
					<EditorBubbleItem
						key={index}
						onSelect={(editor) => {
							item.command(editor);
							onOpenChange(false);
						}}
						className="flex cursor-pointer items-center justify-between rounded-sm px-2 py-1 text-sm hover:bg-accent"
					>
						<div className="flex items-center space-x-2">
							<div className="rounded-sm border p-1">
								<item.icon className="h-3 w-3" />
							</div>
							<span>{item.name}</span>
						</div>
						{activeItem.name === item.name && <Check className="h-4 w-4" />}
					</EditorBubbleItem>
				))}
			</PopoverContent>
		</Popover>
	);
};
