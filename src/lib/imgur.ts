const IMGUR_CLIENT_ID = process.env.NEXT_PUBLIC_IMGUR_CLIENT_ID;

export class ImgurError extends Error {
	constructor(
		message: string,
		public code: number,
	) {
		super(message);
	}
}

// TODO: Replace this in favour of a self-hosted storage
export async function uploadToImgur(file: File): Promise<string> {
	const formData = new FormData();
	formData.append("image", file);

	const response = await fetch("https://api.imgur.com/3/image", {
		method: "POST",
		headers: {
			Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
		},
		body: formData,
	});

	const data = await response.json();

	if (!response.ok) {
		if (data.status) {
			throw new ImgurError("imgur.error.overCapacity", 403);
		}
		if (data.status === 429) {
			throw new ImgurError("imgur.error.rateLimit", 429);
		}
		throw new ImgurError("imgur.error.generic", response.status);
	}

	return data.data.link;
}
