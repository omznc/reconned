"use client";
import { useState } from "react";
import {
	EditorRoot,
	EditorCommand,
	EditorCommandItem,
	EditorCommandEmpty,
	EditorContent,
	type JSONContent,
	EditorCommandList,
	EditorBubble,
} from "novel";
import { ImageResizer, handleCommandNavigation } from "novel/extensions";
import { defaultExtensions } from "@/components/editor/extensions";
import {
	slashCommand,
	suggestionItems,
} from "@/components/editor/slash-command";
import { LinkSelector } from "@/components/editor/selectors/link-selector";
import { NodeSelector } from "@/components/editor/selectors/node-selector";
import { TextButtons } from "@/components/editor/selectors/text-buttons";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const extensions = [...defaultExtensions, slashCommand];

interface EditorProp {
	initialValue?: JSONContent;
	onChange?: (value: JSONContent) => void;
	editable?: boolean;
}
export const Editor = ({ editable, initialValue, onChange }: EditorProp) => {
	const [openNode, setOpenNode] = useState(false);
	const [openLink, setOpenLink] = useState(false);

	return (
		<EditorRoot>
			<EditorContent
				editable={editable}
				className={cn("h-full w-full min-w-full min-h-[300px]")}
				{...(initialValue && { initialContent: initialValue })}
				extensions={extensions}
				editorProps={{
					handleDOMEvents: {
						keydown: (_view, event) => handleCommandNavigation(event),
					},

					attributes: {
						class:
							"prose dark:prose-invert prose-headings:font-title font-default focus:outline-none max-w-full",
					},
				}}
				onUpdate={({ editor }) => {
					onChange?.(editor.getJSON());
				}}
				slotAfter={<ImageResizer />}
			>
				<EditorCommand className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border border-muted bg-background px-1 py-2 shadow-md transition-all">
					<EditorCommandEmpty className="px-2 text-muted-foreground">
						No results
					</EditorCommandEmpty>
					<EditorCommandList>
						{suggestionItems.map((item) => (
							<EditorCommandItem
								value={item.title}
								onCommand={(val) => item.command?.(val)}
								className={
									"flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent aria-selected:bg-accent "
								}
								key={item.title}
							>
								<div className="flex h-10 w-10 items-center justify-center rounded-md border border-muted bg-background">
									{item.icon}
								</div>
								<div>
									<p className="font-medium">{item.title}</p>
									<p className="text-xs text-muted-foreground">
										{item.description}
									</p>
								</div>
							</EditorCommandItem>
						))}
					</EditorCommandList>
				</EditorCommand>

				<EditorBubble
					shouldShow={({ editor, view, state, from, to }) => {
						const { selection } = state;
						const { empty } = selection;

						// Don't show if there's no selection or if it's collapsed
						if (empty) {
							return false;
						}

						return true;
					}}
					tippyOptions={{
						placement: "top",
					}}
					className="flex w-fit max-w-[90vw] overflow-hidden rounded-md border border-muted bg-background shadow-xl"
				>
					<Separator orientation="vertical" />
					<NodeSelector open={openNode} onOpenChange={setOpenNode} />
					<Separator orientation="vertical" />

					<LinkSelector open={openLink} onOpenChange={setOpenLink} />
					<Separator orientation="vertical" />
					<TextButtons />
					<Separator orientation="vertical" />
				</EditorBubble>
			</EditorContent>
		</EditorRoot>
	);
};
