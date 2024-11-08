import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AddManagerForm } from "@/app/dashboard/(club)/[clubId]/members/managers/_components/add-manager-form";

interface PageProps {
	params: Promise<{
		clubId: string;
	}>;
	searchParams: Promise<{
		page?: string;
		pageSize?: string;
		search?: string;
		status?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	const user = await isAuthenticated();

	if (!user) {
		return notFound();
	}

	const club = await prisma.club.findUnique({
		where: {
			members: {
				some: {
					userId: user.id,
					role: {
						in: ["CLUB_OWNER", "MANAGER"],
					},
				},
			},
			id: params.clubId,
		},
	});

	if (!club) {
		return notFound();
	}

	return <AddManagerForm />;
}
