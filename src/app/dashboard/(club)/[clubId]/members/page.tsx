import { MembersTable } from "@/app/dashboard/(club)/[clubId]/members/_components/members-table";
import { prisma } from "@/lib/prisma";
import type { ClubMembership, Prisma, Role, User } from "@prisma/client";

type MembershipWithUser = ClubMembership & {
	user: Pick<
		User,
		| "id"
		| "name"
		| "email"
		| "image"
		| "callsign"
		| "location"
		| "bio"
		| "website"
		| "createdAt"
	>;
};

interface PageProps {
	params: Promise<{ clubId: string }>;
	searchParams: Promise<{
		search?: string;
		role?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
		page?: string;
	}>;
}

export default async function MembersPage(props: PageProps) {
	const { clubId } = await props.params;
	const { search, role, sortBy, sortOrder, page } = await props.searchParams;

	// Convert URL sort params to Prisma sort object
	const orderBy = sortBy
		? {
				...(sortBy === "userName" && {
					user: { name: sortOrder ?? "asc" },
				}),
				...(sortBy === "userCallsign" && {
					user: { callsign: sortOrder ?? "asc" },
				}),
				...(sortBy === "createdAt" && {
					createdAt: sortOrder ?? "asc",
				}),
			}
		: { createdAt: sortOrder ?? ("desc" as const) };

	const where = {
		clubId: clubId,
		...(role && role !== "all" ? { role: role as Role } : {}),
		...(search
			? {
					OR: [
						{ user: { name: { contains: search, mode: "insensitive" } } },
						{ user: { email: { contains: search, mode: "insensitive" } } },
						{ user: { callsign: { contains: search, mode: "insensitive" } } },
					],
				}
			: {}),
	} satisfies Prisma.ClubMembershipWhereInput;

	const members: MembershipWithUser[] = await prisma.clubMembership.findMany({
		orderBy,
		where,
		include: {
			user: {
				select: {
					id: true,
					name: true,
					email: true,
					image: true,
					callsign: true,
					location: true,
					bio: true,
					website: true,
					createdAt: true,
				},
			},
		},
		take: 10,
		skip: Number.parseInt(page ?? "0") * 10,
	});

	// const totalPages = (await prisma.clubMembership.count({ where })) / 10;
	const totalPages = Math.ceil(
		(await prisma.clubMembership.count({ where })) / 10,
	);

	return (
		<div className="space-y-4 w-full md:w-fit max-w-full">
			<div>
				<h3 className="text-lg font-semibold">Svi članovi</h3>
			</div>
			<MembersTable
				totalPages={totalPages}
				key={JSON.stringify({ search, role, sortBy, sortOrder })}
				data={members}
				searchParams={{ search, role, sortBy, sortOrder }}
			/>
		</div>
	);
}
