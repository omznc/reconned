import { redirect } from "next/navigation";

interface PageProps {
	params: Promise<{
		clubId: string;
	}>;
}
export default async function Page(props: PageProps) {
	const params = await props.params;
	redirect(`/dashboard/${params.clubId}/club`);
}
