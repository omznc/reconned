import type { ImageLoaderProps } from "next/image";

export default function cloudflareLoader({ src, width, quality }: ImageLoaderProps) {
	const normalizedSrc = src.startsWith("/") ? src.slice(1) : src;

	const params = [`width=${width}`, quality && `quality=${quality}`].filter(Boolean);

	const base = process.env.NODE_ENV === "development" ? "https://beta.reconned.com" : "";

	return `${base}/cdn-cgi/image/${params.join(",")}/${normalizedSrc}`;
}
