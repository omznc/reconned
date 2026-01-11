import { ImageResponse } from "next/og";
import apiPublic from "@/lib/api/api-public";
import { env } from "@/lib/env";

export const runtime = "edge";
export const alt = "Club";
export const size = {
	width: 1200,
	height: 630,
};
export const contentType = "image/png";

export default async function Image(props: { params: Promise<{ id: string }> }) {
	const params = await props.params;

	const { data: club, error } = await apiPublic.GET("/api/clubs/{id}", {
		params: {
			path: {
				id: params.id,
			},
		},
	});

	if (error || !club) {
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
				<div style={{ fontSize: 60, color: "#fff" }}>Club Not Found</div>
			</div>,
			{
				...size,
			},
		);
	}

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
				{club.logo?.startsWith(env.NEXT_PUBLIC_CDN_URL) && (
					// biome-ignore lint/performance/noImgElement: Can't use next/image here
					<img
						src={club.logo}
						alt={club.name || ""}
						width={192}
						height={192}
						style={{
							width: "192px",
							height: "192px",
							borderRadius: "12px",
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
							display: "flex",
							fontSize: 60,
							fontWeight: "bold",
							letterSpacing: "-0.025em",
						}}
					>
						{club.name || "Airsoft klub"}
					</div>
					<div
						style={{
							display: "flex",
							fontSize: 24,
							marginTop: "8px",
							color: "#e4e4e7",
						}}
					>
						{club.description?.slice(0, 400) || ""}
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
