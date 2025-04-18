import { ImageResponse } from "@vercel/og";
import { env } from "@/lib/env";

export const runtime = "edge";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const name = searchParams.get("name");
	const bio = searchParams.get("bio");
	const callsign = searchParams.get("callsign");
	const avatar = searchParams.get("avatar");

	if (
		avatar && (() => {
			try {
				const parsedUrl = new URL(avatar);
				const allowedHosts = [new URL(env.NEXT_PUBLIC_CDN_URL).host, "lh3.googleusercontent.com"];
				return !allowedHosts.includes(parsedUrl.host);
			} catch {
				return true; // Invalid URL
			}
		})()
	) {
		return new Response("Invalid image URL", { status: 400 });
	}

	const logoUrl = `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/reconned-logo-dark.svg`;

	return new ImageResponse(
		<div
			tw="flex h-full w-full flex-col justify-between bg-black text-white p-16 border border-[10px] border-red-500"
			style={{ fontFamily: "Geist" }}
		>
			<div tw="flex flex-row items-start">
				{avatar && <img src={avatar} tw="w-32 h-32" alt={name ?? ""} />}
				<div tw="flex flex-col flex-1 ml-8">
					<div tw="text-6xl font-bold tracking-tight">{name ?? "Airsoft igrač"}</div>
					{callsign && <div tw="text-3xl mt-4 text-zinc-400">{callsign}</div>}
					<div tw="text-2xl mt-8 text-zinc-200">{bio?.slice(0, 100) ?? ""}</div>
				</div>
			</div>
			<img tw="w-[400px]" src={logoUrl} alt="Reconned" />
		</div>,
		{
			width: 1200,
			height: 630,
		},
	);
}
