import { useExtracted } from "next-intl";
import { GoogleLogo } from "@/components/logos/google-logo";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function GoogleLoginButton({
	redirectTo,
	wasLastMethod,
}: {
	redirectTo?: string | null;
	wasLastMethod?: boolean;
}) {
	const t = useExtracted();

	return (
		<Button
			variant="outline"
			className="relative w-full"
			type="button"
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
			<GoogleLogo /> Google
			{wasLastMethod && (
				<span className="absolute w-full -z-1 -bottom-[1.35rem] bg-red-500/10 text-red-500/80 px-2 pt-3 py-0.5 rounded-b-md text-xs font-semibold">
					{t("Last used")}
				</span>
			)}
		</Button>
	);
}
