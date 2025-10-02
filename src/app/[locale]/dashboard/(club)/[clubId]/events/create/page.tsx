import { notFound } from "next/navigation";
import CreateEventForm from "@/app/[locale]/dashboard/(club)/[clubId]/events/create/_components/events.form";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";



export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/events/create">) {
	const searchParams = await props.searchParams;
	const params = await props.params;
	const user = await isAuthenticated();

	if (!user?.managedClubs.some((club) => club === params.clubId)) {
		return notFound();
	}

	const existingEvent = searchParams?.id
		? await prisma.event.findFirst({
				where: {
					id: searchParams.id as string,
				},
			})
		: null;

	const rules = await prisma.clubRule.findMany({
		where: {
			clubId: params.clubId,
		},
	});

	return <CreateEventForm event={existingEvent} rules={rules} />;
}
