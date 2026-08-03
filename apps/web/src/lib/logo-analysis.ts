/**
 * Choosing the tile a club logo sits on.
 *
 * Uploaded logos are overwhelmingly transparent PNGs, and roughly a fifth of
 * them are white or near-white marks made for dark headers. On the paper tile
 * those disappear entirely. Rather than ask every club "is your logo light?",
 * the answer is read out of the pixels at upload time and stored once.
 *
 * The whole analysis runs in the browser, because that is where the file
 * already is — the server only ever sees a presigned PUT, never the bytes.
 *
 * Five steps, in order:
 *   1. decode the file
 *   2. trim fully transparent padding, so a small mark centred in a big square
 *      canvas is measured on its own terms
 *   3. reject anything wider or taller than 2:1 — the square tile can't frame it
 *   4. average the luminance of the opaque pixels only
 *   5. light mark → ink tile, everything else → paper
 */

export type LogoTile = "paper" | "ink";

/** Past this the mark is a wordmark or a banner, not something a square frames. */
const MAX_ASPECT_RATIO = 2;
/** Alpha below this is padding, not part of the mark. */
const ALPHA_FLOOR = 16;
/**
 * Mean luminance above this reads as a light mark. Set well above mid-grey: a
 * mark has to be genuinely pale before it earns the dark tile, since paper is
 * the house default and the one most logos are drawn for.
 */
const LIGHT_THRESHOLD = 0.72;
/** Analysis runs on a downscale — the average doesn't need every pixel. */
const SAMPLE_SIZE = 128;

export interface LogoAnalysis {
	/** The tile the logo's own pixels ask for. */
	tile: LogoTile;
	/** Mean luminance of the opaque pixels, 0–1. */
	luminance: number;
	/** Long side over short side of the trimmed mark, always >= 1. */
	aspectRatio: number;
	/** False when the mark is too wide or too tall for a square tile. */
	withinAspectRatio: boolean;
}

/** Rec. 709 relative luminance on sRGB values already in 0–1. */
function luminanceOf(r: number, g: number, b: number): number {
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function decode(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve(image);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("Could not read the image"));
		};
		image.src = url;
	});
}

/**
 * Bounds of the non-transparent pixels. A logo exported with generous padding
 * would otherwise report the canvas's aspect ratio rather than the mark's.
 * Returns null when every pixel is transparent.
 */
function opaqueBounds(data: Uint8ClampedArray, width: number, height: number) {
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if ((data[(y * width + x) * 4 + 3] ?? 0) <= ALPHA_FLOOR) continue;
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}
	}

	return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

/**
 * Reads a logo file and reports which tile it wants. Throws only when the file
 * cannot be decoded at all; a logo that is too wide comes back as a normal
 * result with `withinAspectRatio: false`, since that is a message for the
 * uploader rather than an error.
 */
export async function analyzeLogo(file: File): Promise<LogoAnalysis> {
	const image = await decode(file);

	const scale = Math.min(1, SAMPLE_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
	const width = Math.max(1, Math.round(image.naturalWidth * scale));
	const height = Math.max(1, Math.round(image.naturalHeight * scale));

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) {
		throw new Error("Could not read the image");
	}
	ctx.drawImage(image, 0, 0, width, height);
	const { data } = ctx.getImageData(0, 0, width, height);

	const bounds = opaqueBounds(data, width, height);
	// A fully transparent file has nothing to measure and nothing to show; paper
	// is the harmless answer.
	if (!bounds) {
		return { tile: "paper", luminance: 1, aspectRatio: 1, withinAspectRatio: true };
	}

	const markWidth = bounds.maxX - bounds.minX + 1;
	const markHeight = bounds.maxY - bounds.minY + 1;
	const aspectRatio = Math.max(markWidth, markHeight) / Math.min(markWidth, markHeight);

	// Weighted by alpha, so an anti-aliased edge counts for as much of its colour
	// as it actually shows.
	let weighted = 0;
	let weight = 0;
	for (let y = bounds.minY; y <= bounds.maxY; y++) {
		for (let x = bounds.minX; x <= bounds.maxX; x++) {
			const i = (y * width + x) * 4;
			const alpha = data[i + 3] ?? 0;
			if (alpha <= ALPHA_FLOOR) continue;

			const a = alpha / 255;
			weighted += luminanceOf(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0) * a;
			weight += a;
		}
	}

	const luminance = weight > 0 ? weighted / weight : 1;

	return {
		tile: luminance >= LIGHT_THRESHOLD ? "ink" : "paper",
		luminance,
		aspectRatio,
		withinAspectRatio: aspectRatio <= MAX_ASPECT_RATIO,
	};
}

export { MAX_ASPECT_RATIO };
