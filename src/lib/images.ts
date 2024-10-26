import sharp from "sharp";

const generateBlurDataUrl = async (imagePathOrBuffer: Buffer | string) => {
	try {
		const buffer = await sharp(imagePathOrBuffer)
			.resize(20) // Resize to very small dimensions
			.blur(10) // Apply blur effect
			.toBuffer();

		const base64Data = buffer.toString("base64");
		return `data:image/jpeg;base64,${base64Data}`;
	} catch (error) {
		console.error("Error generating blur data:", error);
		throw error;
	}
};
