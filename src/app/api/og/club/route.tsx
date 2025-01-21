import { ImageResponse } from "@vercel/og";
import { env } from "@/lib/env";

export const runtime = "edge";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const name = searchParams.get("name");
	const description = searchParams.get("description");
	const logo = searchParams.get("logo");

	if (logo && !logo.startsWith(env.NEXT_PUBLIC_CDN_URL)) {
		return new Response("Invalid image URL", { status: 400 });
	}

	const logoUrl = `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/reconned-logo-dark.svg`;

	return new ImageResponse(
		<div
			tw="flex h-full w-full flex-col justify-between bg-black text-white p-16 border border-[10px] border-red-500"
			style={{ fontFamily: "Geist" }}
		>
			<div tw="flex flex-row items-start">
				{logo && <img src={logo} tw="w-48 rounded-xl" alt={name ?? ""} />}
				<div tw="flex flex-col flex-1 ml-8">
					<div tw="flex text-6xl font-bold tracking-tight">
						{name ?? "Airsoft klub"}
					</div>
					<div tw="flex text-2xl mt-2 text-zinc-200">
						{description?.slice(0, 100) ?? ""}
					</div>
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
