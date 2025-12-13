import { PostsForm } from "@/app/[locale]/dashboard/(club)/[clubId]/club/posts/_components/posts.form";
import { prisma } from "@/lib/prisma";

export default async function Page({ params, searchParams }: PageProps<"/[locale]/dashboard/[clubId]/club/posts">) {
	const { clubId } = await params;
	const { postId } = await searchParams;

	const editingPost = postId
		? await prisma.post.findUnique({
				where: { id: postId as string, clubId },
			})
		: null;

	return <PostsForm key={postId as string} clubId={clubId} editingPost={editingPost} />;
}
