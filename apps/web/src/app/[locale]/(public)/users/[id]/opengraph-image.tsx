import { ImageResponse } from "next/og";
import apiPublic from "@/lib/api/api-public";
import { env } from "@/lib/env";

export const runtime = "edge";
export const alt = "User";
export const size = {
	width: 1200,
	height: 630,
};
export const contentType = "image/png";

export default async function Image(props: { params: Promise<{ id: string }> }) {
	const params = await props.params;

	const { data: user, error } = await apiPublic.GET("/api/users/{id}/profile", {
		params: {
			path: {
				id: params.id,
			},
		},
	});

	if (error || !user) {
		return new ImageResponse(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "#000",
				}}
			>
				<div style={{ fontSize: 60, color: "#fff" }}>User Not Found</div>
			</div>,
			{
				...size,
			},
		);
	}

	// Validate avatar URL
	const isValidAvatar =
		user.image &&
		(() => {
			try {
				const parsedUrl = new URL(user.image);
				const allowedHosts = [new URL(env.NEXT_PUBLIC_CDN_URL).host, "lh3.googleusercontent.com"];
				return allowedHosts.includes(parsedUrl.host);
			} catch {
				return false;
			}
		})();

	const logoUrl = `${env.NEXT_PUBLIC_WEB_URL}/reconned-logo-dark.svg`;

	return new ImageResponse(
		<div
			style={{
				display: "flex",
				height: "100%",
				width: "100%",
				flexDirection: "column",
				justifyContent: "space-between",
				backgroundColor: "#000",
				color: "#fff",
				padding: "64px",
				border: "10px solid #ef4444",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "row",
					alignItems: "flex-start",
				}}
			>
				{isValidAvatar && user.image && (
					// biome-ignore lint/performance/noImgElement: Can't use next/image here
					<img
						src={user.image}
						alt={user.name || ""}
						width={128}
						height={128}
						style={{
							width: "128px",
							height: "128px",
							objectFit: "cover",
						}}
					/>
				)}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						flex: 1,
						marginLeft: "32px",
					}}
				>
					<div
						style={{
							fontSize: 60,
							fontWeight: "bold",
							letterSpacing: "-0.025em",
						}}
					>
						{user.name || "Airsoft Player"}
					</div>
					{user.callsign && (
						<div
							style={{
								fontSize: 36,
								marginTop: "16px",
								color: "#a1a1aa",
							}}
						>
							{user.callsign}
						</div>
					)}
					<div
						style={{
							fontSize: 24,
							marginTop: "32px",
							color: "#e4e4e7",
						}}
					>
						{user.bio?.slice(0, 100) || ""}
					</div>
				</div>
			</div>
			{/** biome-ignore lint/performance/noImgElement: Can't use next/image here */}
			<img
				src={logoUrl}
				alt="Reconned"
				width={400}
				style={{
					width: "400px",
				}}
			/>
		</div>,
		{
			...size,
		},
	);
}
