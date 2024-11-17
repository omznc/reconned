import {
	CheckSquare,
	Code,
	Heading1,
	Heading2,
	Heading3,
	ImageIcon,
	List,
	ListOrdered,
	MessageSquarePlus,
	Text,
	TextQuote,
} from "lucide-react";
import { createSuggestionItems } from "novel/extensions";
import { Command, renderItems } from "novel/extensions";

export const suggestionItems = createSuggestionItems([
	{
		title: "Tekst",
		description: "Započnite pisanje običnim tekstom.",
		searchTerms: ["p", "paragraf", "tekst"],
		icon: <Text size={18} />,
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.toggleNode("paragraph", "paragraph")
				.run();
		},
	},
	{
		title: "Lista zadataka",
		description: "Pratite zadatke sa listom za označavanje.",
		searchTerms: ["zadatak", "lista", "označi", "checkbox"],
		icon: <CheckSquare size={18} />,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleTaskList().run();
		},
	},
	{
		title: "Naslov 1",
		description: "Veliki naslov sekcije.",
		searchTerms: ["naslov", "veliki"],
		icon: <Heading1 size={18} />,
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setNode("heading", { level: 1 })
				.run();
		},
	},
	{
		title: "Naslov 2",
		description: "Srednji naslov sekcije.",
		searchTerms: ["podnaslov", "srednji"],
		icon: <Heading2 size={18} />,
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setNode("heading", { level: 2 })
				.run();
		},
	},
	{
		title: "Naslov 3",
		description: "Mali naslov sekcije.",
		searchTerms: ["podnaslov", "mali"],
		icon: <Heading3 size={18} />,
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setNode("heading", { level: 3 })
				.run();
		},
	},
	{
		title: "Lista sa tačkama",
		description: "Kreirajte jednostavnu listu sa tačkama.",
		searchTerms: ["neuređena", "tačke", "lista"],
		icon: <List size={18} />,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleBulletList().run();
		},
	},
	{
		title: "Numerisana lista",
		description: "Kreirajte listu sa brojevima.",
		searchTerms: ["uređena", "brojevi", "lista"],
		icon: <ListOrdered size={18} />,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleOrderedList().run();
		},
	},
	{
		title: "Citat",
		description: "Dodajte citat.",
		searchTerms: ["citat", "navod"],
		icon: <TextQuote size={18} />,
		command: ({ editor, range }) =>
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.toggleNode("paragraph", "paragraph")
				.toggleBlockquote()
				.run(),
	},
	{
		title: "Kod",
		description: "Dodajte isječak koda.",
		searchTerms: ["kod", "programiranje"],
		icon: <Code size={18} />,
		command: ({ editor, range }) =>
			editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
	},
]);

export const slashCommand = Command.configure({
	suggestion: {
		items: () => suggestionItems,
		render: renderItems,
	},
});
