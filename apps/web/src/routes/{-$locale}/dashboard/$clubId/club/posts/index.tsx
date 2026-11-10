import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { PostsForm } from "@/routes/{-$locale}/dashboard/$clubId/club/posts/-components/posts.form";

const getPostFn = createServerFn({ method: "GET" })
	.validator(z.object({ clubId: z.string(), postId: z.string().optional() }))
	.handler(async ({ data }) => {
		if (!data.postId) {
			return null;
		}
		const { data: post } = await apiServer.GET("/api/clubs/{id}/posts/{postId}", {
			params: { path: { id: data.clubId, postId: data.postId } },
		});
		return post ?? null;
	});

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/club/posts/")({
	validateSearch: z.object({ postId: z.coerce.string().optional() }),
	loaderDeps: ({ search }) => ({ postId: search.postId }),
	loader: async ({ params, deps }) => ({
		editingPost: await getPostFn({ data: { clubId: params.clubId, postId: deps.postId } }),
		postId: deps.postId,
	}),
	notFoundComponent: NotFoundPage,
	component: PostsPage,
});

function PostsPage() {
	const { clubId } = Route.useParams();
	const { editingPost, postId } = Route.useLoaderData();

	return <PostsForm key={postId} clubId={clubId} editingPost={editingPost} />;
}
