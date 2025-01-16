import { ImageResponse } from "@vercel/og";
import { env } from "@/lib/env";

export const runtime = "edge";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get("title");
    const description = searchParams.get("description");
    const date = searchParams.get("date");
    const image = searchParams.get("image");

    if (image && !image.startsWith(env.NEXT_PUBLIC_CDN_URL)) {
        return new Response("Invalid image URL", { status: 400 });
    }

    const logoUrl = `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/reconned-logo-dark.svg`;

    return new ImageResponse(
        (
            <div
                tw="flex h-full w-full flex-col justify-between bg-black text-white p-16 border border-[10px] border-red-500"
                style={{ fontFamily: "Geist" }}
            >
                <div tw="flex flex-row items-start justify-between">
                    <div tw="flex flex-col flex-1 ml-8">
                        <div tw="text-6xl font-bold tracking-tight max-w-[600px]">
                            {title ?? "Airsoft susret"}
                        </div>
                        <div tw="text-2xl mt-8 text-zinc-200">
                            {description?.slice(0, 100) ?? ""}
                        </div>
                        {date && <div tw="mt-6 text-xl text-zinc-400">{date}</div>}
                    </div>
                    {image && (
                        <img
                            src={image}
                            tw="w-[200px]"
                            alt={title ?? ""}
                        />
                    )}
                </div>
                <img
                    tw="w-[400px]"
                    src={logoUrl}
                    alt="Reconned"
                />
            </div>
        ),
        {
            width: 1200,
            height: 630,
        },
    );
}
