"use client";

import { authClient } from "@auth/client";
import { GoogleLogo } from "@components/logos/google-logo";
import { Button } from "@components/ui/button";

export function GoogleLoginButton({ isLoading }: { isLoading: boolean }) {
	return (
		<Button
			variant="outline"
			className="w-full"
			type="button"
			disabled={isLoading}
			onClick={async () => {
				await authClient.signIn.social({
					provider: "google",
				});
			}}
		>
			<GoogleLogo /> Koristi Google
		</Button>
	);
}
