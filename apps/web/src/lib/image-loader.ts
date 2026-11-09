export type ImageLoaderProps = {
	src: string;
	width: number;
	quality?: number;
};

const normalizeSrc = (src: string) => {
	return src.startsWith("/") ? src.slice(1) : src;
};

export default function cloudflareLoader({ src, width, quality }: ImageLoaderProps) {
	const params = [`width=${width}`];
	if (quality) {
		params.push(`quality=${quality}`);
	}
	if (import.meta.env.DEV) {
		const separator = src.includes("?") ? "&" : "?";
		return `${src}${separator}${params.join("&")}`;
	}
	return `/cdn-cgi/image/${params.join(",")}/${normalizeSrc(src)}`;
}
