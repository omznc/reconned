import { z } from "zod";

export const postSchema = z.object({
	id: z.string().optional(),
	title: z.string().min(1, "Naslov je obavezan").max(200, "Naslov je predug"),
	content: z.string(),
	// images: z.array(z.string().url("Nevažeći URL")).optional(),
	isPublic: z.boolean(),
	clubId: z.string(),
});

export const deletePostSchema = z.object({
	postId: z.string(),
	clubId: z.string(),
});
