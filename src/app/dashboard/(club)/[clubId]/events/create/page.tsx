import CreateEventForm from "@/app/dashboard/(club)/[clubId]/events/create/_components/create-event-form";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

interface PageProps {
	searchParams: Promise<{
		id?: string;
	}>;
	params: Promise<{
		clubId: string;
	}>;
}

export default async function Page(props: PageProps) {
	const searchParams = await props.searchParams;
	const params = await props.params;
	const user = await isAuthenticated();

	if (!user.managedClubs.some((club) => club === params.clubId)) {
		return notFound();
	}

	const existingEvent = searchParams?.id
		? await prisma.event.findFirst({
				where: {
					id: searchParams.id,
				},
			})
		: null;

	return <CreateEventForm event={existingEvent} />;
}
