import { PostsForm } from "@/app/dashboard/(club)/[clubId]/club/posts/_components/posts.form";
import { prisma } from "@/lib/prisma";

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ clubId: string }>;
	searchParams: Promise<{ postId?: string }>;
}) {
	const { clubId } = await params;
	const { postId } = await searchParams;

	const editingPost = postId
		? await prisma.post.findUnique({
				where: { id: postId, clubId },
			})
		: null;

	return <PostsForm key={postId} clubId={clubId} editingPost={editingPost} />;
}
