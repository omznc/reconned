import CreateEventForm from "@/app/dashboard/[clubId]/events/create/_components/create-event-form";
import { prisma } from "@/lib/prisma";

interface PageProps {
	searchParams: Promise<{
		id?: string;
	}>;
}

export default async function Page(props: PageProps) {
	const searchParams = await props.searchParams;
	const existingEvent = searchParams?.id
		? await prisma.event.findFirst({
				where: {
					id: searchParams.id,
				},
			})
		: null;

	return <CreateEventForm event={existingEvent} />;
}
