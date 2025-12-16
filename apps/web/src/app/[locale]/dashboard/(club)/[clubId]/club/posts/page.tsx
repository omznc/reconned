import { PostsForm } from "@/app/[locale]/dashboard/(club)/[clubId]/club/posts/_components/posts.form";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type ClubPost = ApiResponse<"/api/clubs/{id}/posts/{postId}", "get">;

export default async function Page({ params, searchParams }: PageProps<"/[locale]/dashboard/[clubId]/club/posts">) {
	const { clubId } = await params;
	const { postId } = await searchParams;

	let editingPost: ClubPost | null = null;

	if (postId) {
		const { data } = await apiServer.GET("/api/clubs/{id}/posts/{postId}", {
			params: {
				path: {
					id: clubId,
					postId: postId as string,
				},
			},
		});
		editingPost = data ?? null;
	}

	return <PostsForm key={postId as string} clubId={clubId} editingPost={editingPost} />;
}
