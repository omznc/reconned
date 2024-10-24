import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { AtSign, Eye, EyeOff, Mail, Phone, Pin, User } from "lucide-react";

interface PageProps {
	searchParams: Promise<{
		club: string;
	}>;
}

export default async function Page(props: PageProps) {
	const searchParams = await props.searchParams;
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const clubs = await prisma.club.findMany({
		where: {
			members: {
				some: {
					userId: user.id,
					role: {
						in: ["CLUB_OWNER", "MANAGER"],
					},
				},
			},
			...(searchParams.club && {
				id: searchParams.club,
			}),
		},
		take: 1,
		include: {
			_count: {
				select: {
					members: true,
				},
			},
		},
	});

	if (clubs.length === 0) {
		return notFound();
	}

	const club = clubs[0];

	return (
		<>
			<header className="flex h-8 mb-4 transition-all sticky overflow-hidden top-0 bg-background/20 backdrop-blur-sm border px-2 shrink-0 items-center gap-2 ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-8">
				<div className="flex items-center gap-2">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-2 h-4" />
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem className="hidden md:block">
								<BreadcrumbLink href="/dashboard/club">Klub</BreadcrumbLink>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
			</header>

			<div className="space-y-4 max-w-3xl">
				<div className="flex gap-4">
					<Image
						src={club.logo}
						alt={club.name}
						width={150}
						height={150}
						className="h-[150px] w-auto"
						draggable={false}
					/>
					<div className="flex select-none flex-col gap-1">
						<h1 className="text-2xl font-semibold">{club.name}</h1>
						<p className="text-accent-foreground/80">{club.description}</p>
						<div className="flex flex-wrap gap-1 max-w-full md:max-w-[400px]">
							<Badge variant="outline" className="flex items-center gap-1">
								<User className="w-4 h-4" />
								{club._count?.members}
							</Badge>
							<Badge variant="outline" className="flex items-center gap-1">
								{club.isPrivate ? (
									<>
										<EyeOff className="w-4 h-4" />
										Privatni klub
									</>
								) : (
									<>
										<Eye className="w-4 h-4" />
										Javni klub
									</>
								)}
							</Badge>
							{club.location && (
								<Badge variant="outline" className="flex items-center gap-1">
									<Pin className="w-4 h-4" />
									{club.location}
								</Badge>
							)}
							{club.contactEmail && (
								<Badge variant="outline" className="flex items-center gap-1">
									<AtSign className="w-4 h-4" />
									{club.contactEmail}
								</Badge>
							)}
							{club.contactPhone && (
								<Badge variant="outline" className="flex items-center gap-1">
									<Phone className="w-4 h-4" />
									{club.contactPhone}
								</Badge>
							)}
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
