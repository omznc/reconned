/**
 * WebGL support detection utilities
 */

export interface WebGLSupport {
	supported: boolean;
	reason?: string;
	webgl1: boolean;
	webgl2: boolean;
}

/**
 * Check if WebGL is available and working
 */
export function checkWebGLSupport(): WebGLSupport {
	// Check if we're in a browser environment
	if (typeof document === "undefined" || typeof window === "undefined") {
		return {
			supported: false,
			reason: "Not in browser environment",
			webgl1: false,
			webgl2: false,
		};
	}

	// Create a temporary canvas to test WebGL
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;

	let webgl1 = false;
	let webgl2 = false;
	let reason: string | undefined;

	// Try WebGL2 first (preferred by MapLibre)
	try {
		const gl2 = canvas.getContext("webgl2", {
			failIfMajorPerformanceCaveat: false,
		});
		if (gl2) {
			webgl2 = true;
		}
	} catch {
		// WebGL2 not available
	}

	// Try WebGL1
	try {
		const gl1 =
			canvas.getContext("webgl", {
				failIfMajorPerformanceCaveat: false,
			}) ||
			canvas.getContext("experimental-webgl", {
				failIfMajorPerformanceCaveat: false,
			});
		if (gl1) {
			webgl1 = true;
		}
	} catch {
		// WebGL1 not available
	}

	// Determine if supported
	const supported = webgl1 || webgl2;

	if (!supported) {
		// Try to determine the reason
		const testCanvas = document.createElement("canvas");
		try {
			const context = testCanvas.getContext("2d");
			if (!context) {
				reason = "Canvas not supported";
			} else {
				reason =
					"WebGL is disabled or not available. Please enable hardware acceleration in your browser settings.";
			}
		} catch {
			reason = "Canvas not supported";
		}
	}

	return {
		supported,
		reason,
		webgl1,
		webgl2,
	};
}

/**
 * Hook to check WebGL support (for client components)
 */
export function useWebGLSupport(): WebGLSupport {
	// Default to unsupported for SSR
	if (typeof window === "undefined") {
		return {
			supported: false,
			reason: "Server-side rendering",
			webgl1: false,
			webgl2: false,
		};
	}

	return checkWebGLSupport();
}

/**
 * Get user-friendly error message for WebGL issues
 */
export function getWebGLErrorMessage(support: WebGLSupport): string {
	if (support.supported) {
		return "";
	}

	if (support.reason) {
		return support.reason;
	}

	return "WebGL is not available. This feature requires a browser with WebGL support and hardware acceleration enabled.";
}
