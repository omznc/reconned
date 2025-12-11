import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getExtracted } from "next-intl/server";
import { emailStyles } from "@/emails/styles";
import { env } from "@/lib/env";

interface PasswordResetProps {
	resetUrl: string;
	userName?: string;
}

export const PasswordReset = async ({ resetUrl, userName }: PasswordResetProps) => {
	const t = await getExtracted();

	return (
		<Html>
			<Head />
			<Preview>{t("Reset your password")}</Preview>
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
					<Heading style={emailStyles.h1}>{t("Reset your password")}</Heading>
					{userName ? (
						<Text style={emailStyles.text}>{t("Hello {name}", { name: userName })}</Text>
					) : (
						<Text style={emailStyles.text}>{t("Hello")}</Text>
					)}
					<Text style={emailStyles.text}>
						{t("To reset your password, please click on the button below")}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={resetUrl}>
							{t("Reset my password")}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						{t("If this email is unexpected, and you didn't request a password reset, simply ignore it.")}
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default PasswordReset;
