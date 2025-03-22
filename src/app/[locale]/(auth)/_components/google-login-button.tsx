import { GoogleLogo } from "@/components/logos/google-logo";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function GoogleLoginButton({
	isLoading,
	redirectTo,
	turnstileToken,
}: {
	isLoading: boolean;
	redirectTo?: string | null;
	turnstileToken?: string | null;
}) {
	return (
		<Button
			variant="outline"
			className="w-full plausible-event-name=google-button-click"
			type="button"
			disabled={isLoading || !turnstileToken}
			onClick={async () => {
				await authClient.signIn.social(
					{
						provider: "google",
						callbackURL: redirectTo || "/",
						fetchOptions: {
							headers: {
								"x-captcha-response": turnstileToken || "",
							},
						},
					},
					{},
				);
			}}
		>
			<GoogleLogo /> Google
		</Button>
	);
}
