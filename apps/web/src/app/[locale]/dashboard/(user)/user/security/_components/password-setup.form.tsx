import { Button } from "@components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert";
import { MailIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

export function SetupPasswordForm({
	isLoading,
	setIsLoading,
}: {
	isLoading: boolean;
	setIsLoading: Dispatch<SetStateAction<boolean>>;
}) {
	const t = useExtracted();
	const [emailSent, setEmailSent] = useState(false);
	const session = authClient.useSession();
	const user = session.data?.user;

	const onSendResetEmail = async () => {
		if (!user?.email) {
			toast.error(t("Unable to get user email"));
			return;
		}

		setIsLoading(true);
		try {
			const response = await authClient.requestPasswordReset({
				email: user.email,
				redirectTo: "/reset-password",
			});

			if (!response?.error) {
				setEmailSent(true);
				toast.success(t("Password reset email sent"));
			} else {
				toast.error(t("An error occurred while sending the reset email"));
			}
		} catch (_e) {
			toast.error(t("An error occurred while sending the reset email"));
		} finally {
			setIsLoading(false);
		}
	};

	if (emailSent) {
		return (
			<Alert>
				<MailIcon className="h-4 w-4" />
				<AlertTitle>{t("Check your email")}</AlertTitle>
				<AlertDescription>
					{t("We've sent you a password reset link. Click the link in the email to set your password.")}
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="space-y-4 w-full">
			<div>
				<h3 className="text-lg font-semibold">{t("Set a password")}</h3>
				<p className="text-sm text-muted-foreground">
					{t("Since you signed in with a social provider, you need to set a password to enable additional security features.")}
				</p>
			</div>
			<Button onClick={onSendResetEmail} className="w-full" disabled={isLoading}>
				<MailIcon className="w-4 h-4 mr-2" />
				{isLoading ? t("Sending...") : t("Send password reset email")}
			</Button>
		</div>
	);
}
