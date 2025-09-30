import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getTranslations } from "next-intl/server";
import { emailStyles } from "@/emails/styles";
import { env } from "@/lib/env";

interface PasswordResetProps {
	resetUrl: string;
	userName?: string;
}

export const PasswordReset = async ({ resetUrl, userName }: PasswordResetProps) => {
	const t = await getTranslations();

	return (
		<Html>
			<Head />
			<Preview>{t("emails.passwordReset.title")}</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img
							src={`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/logo.png`}
							alt="Logo"
							width="150"
							style={emailStyles.logo}
						/>
					</Section>
					<Heading style={emailStyles.h1}>{t("emails.passwordReset.title")}</Heading>
					{userName ? (
						<Text style={emailStyles.text}>{t("emails.passwordReset.helloUser", { name: userName })}</Text>
					) : (
						<Text style={emailStyles.text}>{t("emails.passwordReset.hello")}</Text>
					)}
					<Text style={emailStyles.text}>{t("emails.passwordReset.message")}</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={resetUrl}>
							{t("emails.passwordReset.action")}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{t("emails.passwordReset.footer")}</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default PasswordReset;
