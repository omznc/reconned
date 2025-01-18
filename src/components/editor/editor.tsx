"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
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
	Link as LinkIcon,
	Link2Off,
} from "lucide-react";
import "./editor.css";
import { Button } from "@/components/ui/button";
import { usePrompt } from "@/components/ui/alert-dialog-provider";

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
		extensions: [
			StarterKit,
			Link.configure({
				openOnClick: false,
				autolink: true,
				defaultProtocol: 'https',
				protocols: ['http', 'https'],
				HTMLAttributes: {
					class: 'text-primary underline',
				},
			}),

		],
		content: initialValue,
		editable,
		onUpdate: ({ editor }) => {
			onChange?.(editor.getHTML());
		},
	});
	const prompt = usePrompt();

	const setLink = async () => {
		if (!editor) {
			return;
		}

		const previousUrl = editor.getAttributes('link').href;
		const url = await prompt({
			title: "Unesi link",
			body: "Ako ne unesete http:// ili https://, automatski će se dodati https://",
			defaultValue: previousUrl,
			actionButton: "Sačuvaj",
			cancelButton: "Otkaži",
			inputType: "input",
			inputProps: {
				type: "url",
				placeholder: "https://example.com",
			},
		});

		if (!url) {
			return;
		}

		if (url === '') {
			editor.chain().focus().unsetLink().run();
			return;
		}

		if (!(url.startsWith('http://') || url.startsWith('https://'))) {
			editor.chain().focus().unsetLink().run();
			return;
		}

		editor.chain().focus().setLink({ href: url }).run();
	};

	const handleContainerClick = () => {
		if (editable && editor) {
			editor.chain().focus().run();
		}
	};

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

					<div className="w-px h-6 bg-border mx-1" />

					<ToolbarButton
						onClick={setLink}
						active={editor.isActive('link')}
					>
						<LinkIcon className="h-4 w-4" />
					</ToolbarButton>

					<ToolbarButton
						onClick={() => editor.chain().focus().unsetLink().run()}
						disabled={!editor.isActive('link')}
					>
						<Link2Off className="h-4 w-4" />
					</ToolbarButton>
				</div>
			)}

			<div
				onClick={handleContainerClick}
				className={cn(
					"cursor-text",
					editable ? "min-h-[150px]" : ""
				)}
			>
				<EditorContent
					editor={editor}
					className={cn(
						"prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0",
						"p-4",
					)}
				/>
			</div>
		</div>
	);
};
