"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "@/lib/utils";
import {
	Bold,
	Italic,
	List,
	ListOrdered,
	Quote,
	Heading2,
	Heading3,
	Minus,
} from "lucide-react";
import "./editor.css";
import { Button } from "@/components/ui/button";

interface EditorProps {
	initialValue?: string;
	onChange?: (value: string) => void;
	editable?: boolean;
}

const ToolbarButton = ({
	onClick,
	active,
	disabled,
	children,
}: {
	onClick: () => void;
	active?: boolean;
	disabled?: boolean;
	children: React.ReactNode;
}) => {
	return (
		<Button
			type="button"
			variant={active ? "secondary" : "ghost"}
			size="icon"
			onClick={onClick}
			disabled={disabled}
			className="h-8 w-8"
		>
			{children}
		</Button>
	);
};

export const Editor = ({
	editable = true,
	initialValue = "",
	onChange,
}: EditorProps) => {
	const editor = useEditor({
		extensions: [StarterKit],
		content: initialValue,
		editable,
		onUpdate: ({ editor }) => {
			onChange?.(editor.getHTML());
		},
	});

	return (
		<div className="relative border rounded-lg">
			{editable && editor && (
				<div className="flex flex-wrap gap-1 p-1 border-b items-center">
					<ToolbarButton
						onClick={() => editor.chain().focus().toggleBold().run()}
						active={editor.isActive("bold")}
					>
						<Bold className="h-4 w-4" />
					</ToolbarButton>

					<ToolbarButton
						onClick={() => editor.chain().focus().toggleItalic().run()}
						active={editor.isActive("italic")}
					>
						<Italic className="h-4 w-4" />
					</ToolbarButton>

					<div className="w-px h-6 bg-border mx-1" />

					<ToolbarButton
						onClick={() =>
							editor.chain().focus().toggleHeading({ level: 2 }).run()
						}
						active={editor.isActive("heading", { level: 2 })}
					>
						<Heading2 className="h-4 w-4" />
					</ToolbarButton>

					<ToolbarButton
						onClick={() =>
							editor.chain().focus().toggleHeading({ level: 3 }).run()
						}
						active={editor.isActive("heading", { level: 3 })}
					>
						<Heading3 className="h-4 w-4" />
					</ToolbarButton>

					<div className="w-px h-6 bg-border mx-1" />

					<ToolbarButton
						onClick={() => editor.chain().focus().toggleBulletList().run()}
						active={editor.isActive("bulletList")}
					>
						<List className="h-4 w-4" />
					</ToolbarButton>

					<ToolbarButton
						onClick={() => editor.chain().focus().toggleOrderedList().run()}
						active={editor.isActive("orderedList")}
					>
						<ListOrdered className="h-4 w-4" />
					</ToolbarButton>

					<div className="w-px h-6 bg-border mx-1" />

					<ToolbarButton
						onClick={() => editor.chain().focus().toggleBlockquote().run()}
						active={editor.isActive("blockquote")}
					>
						<Quote className="h-4 w-4" />
					</ToolbarButton>

					<ToolbarButton
						onClick={() => editor.chain().focus().setHorizontalRule().run()}
					>
						<Minus className="h-4 w-4" />
					</ToolbarButton>
				</div>
			)}

			<EditorContent
				editor={editor}
				className={cn(
					"prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0",
					"p-4",
					{
						"min-h-[150px]": editable,
					},
				)}
			/>
		</div>
	);
};
