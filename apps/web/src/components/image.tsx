import type { CSSProperties, ImgHTMLAttributes } from "react";
import cloudflareLoader from "@/lib/image-loader";

const DEVICE_WIDTHS = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
const DEFAULT_QUALITY = 75;

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> & {
	src: string;
	alt: string;
	width?: number;
	height?: number;
	/** Fill the positioned parent, like `next/image` `fill`. */
	fill?: boolean;
	quality?: number;
	/** Eager load with high fetch priority, like `next/image` `priority`. */
	priority?: boolean;
	unoptimized?: boolean;
};

function buildSrcSet(src: string, quality: number, width?: number) {
	if (width) {
		return [1, 2]
			.map((density) => `${cloudflareLoader({ src, width: width * density, quality })} ${density}x`)
			.join(", ");
	}
	return DEVICE_WIDTHS.map((step) => `${cloudflareLoader({ src, width: step, quality })} ${step}w`).join(", ");
}

function optimizedAttrs(o: {
	src: string;
	width?: number;
	fill?: boolean;
	quality: number;
	unoptimized?: boolean;
	sizes?: string;
}) {
	const { src, width, fill, quality, unoptimized, sizes } = o;
	const isRaster = !(unoptimized || src.startsWith("data:") || src.startsWith("blob:") || src.endsWith(".svg"));
	if (!isRaster) {
		return { src };
	}
	return {
		src: cloudflareLoader({ src, width: width ?? DEVICE_WIDTHS[3] ?? 1080, quality }),
		srcSet: buildSrcSet(src, quality, fill ? undefined : width),
		sizes: sizes ?? (fill ? "100vw" : undefined),
	};
}

/** Replacement for `next/image`: an `<img>` with a Cloudflare `srcset`. */
export function Image({
	src,
	alt,
	width,
	height,
	fill,
	quality = DEFAULT_QUALITY,
	priority,
	unoptimized,
	sizes,
	style,
	loading,
	...props
}: ImageProps) {
	const optimized = optimizedAttrs({ src, width, fill, quality, unoptimized, sizes });
	const fillStyle: CSSProperties | undefined = fill
		? { position: "absolute", inset: 0, width: "100%", height: "100%" }
		: undefined;

	return (
		// biome-ignore lint/performance/noImgElement: this is the image component, it renders the optimized <img>
		<img
			{...props}
			{...optimized}
			alt={alt}
			width={fill ? undefined : width}
			height={fill ? undefined : height}
			loading={priority ? "eager" : (loading ?? "lazy")}
			fetchPriority={priority ? "high" : undefined}
			decoding="async"
			style={{ ...fillStyle, ...style }}
		/>
	);
}
