import { ImageResponse } from "next/og";
import apiPublic from "@/lib/api/api-public";
import { env } from "@/lib/env";

export const runtime = "edge";
export const alt = "Event";
export const size = {
	width: 1200,
	height: 630,
};
export const contentType = "image/png";

export default async function Image(props: { params: Promise<{ id: string }> }) {
	const params = await props.params;

	const { data, error } = await apiPublic.GET("/api/events/{id}", {
		params: {
			path: {
				id: params.id,
			},
		},
	});

	if (error || !data) {
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
				<div style={{ fontSize: 60, color: "#fff" }}>Event Not Found</div>
			</div>,
			{
				...size,
			},
		);
	}

	const event = data.event;
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
					justifyContent: "space-between",
				}}
			>
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
							maxWidth: "600px",
						}}
					>
						{event.name || "Airsoft Event"}
					</div>
					<div
						style={{
							fontSize: 24,
							marginTop: "32px",
							color: "#e4e4e7",
						}}
					>
						{event.description?.slice(0, 100) || ""}
					</div>
					{event.dateStart && (
						<div
							style={{
								marginTop: "24px",
								fontSize: 20,
								color: "#a1a1aa",
							}}
						>
							{new Date(event.dateStart).toLocaleDateString("bs")}
						</div>
					)}
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
