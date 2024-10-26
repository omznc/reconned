import type { User } from "@prisma/client";
import Image from "next/image";

interface UserOverviewProps {
	user: User;
}

export function UserOverview({ user }: UserOverviewProps) {
	return (
		<>
			<div className="flex gap-4">
				{/* TODO: Handle if unset */}
				{user.image && (
					<Image
						suppressHydrationWarning={true}
						src={`${user.image}?v=${user.updatedAt}`} // This will revalidate the browser cache
						alt={user.name}
						width={150}
						height={150}
						className="h-[150px] w-auto"
						draggable={false}
					/>
				)}
				<div className="flex select-none flex-col gap-1">
					<h1 className="text-2xl font-semibold">
						{user.name} {user.callsign && `(${user.callsign})`}
					</h1>
					<p className="text-accent-foreground/80">{user.bio}</p>
				</div>
			</div>
		</>
	);
}
