import { PostsForm } from "@/app/dashboard/(club)/[clubId]/club/posts/_components/posts.form";
import { prisma } from "@/lib/prisma";

export default async function Page({
	params: { clubId },
	searchParams: { postId },
}: {
	params: { clubId: string };
	searchParams: { postId?: string };
}) {
	const editingPost = postId
		? await prisma.post.findUnique({
				where: { id: postId, clubId },
			})
		: null;

	return <PostsForm key={postId} clubId={clubId} editingPost={editingPost} />;
}
