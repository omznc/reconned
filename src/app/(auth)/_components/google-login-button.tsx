import { GoogleLogo } from "@/components/logos/google-logo";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function GoogleLoginButton({
	isLoading,
	redirectTo,
}: {
	isLoading: boolean;
	redirectTo?: string | null;
}) {
	return (
		<Button
			variant="outline"
			className="w-full"
			type="button"
			disabled={isLoading}
			onClick={async () => {
				await authClient.signIn.social(
					{
						provider: "google",
						callbackURL: redirectTo || "/",
					},
					{},
				);
			}}
		>
			<GoogleLogo /> Koristi Google
		</Button>
	);
}
