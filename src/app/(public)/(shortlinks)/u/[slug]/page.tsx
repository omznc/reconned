import { redirect } from "next/navigation";

interface PageProps {
	params: Promise<{ slug: string; }>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	redirect(`/users/${params.slug}`);
}
