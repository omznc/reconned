import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getExtracted } from "next-intl/server";
import { emailStyles } from "@/emails/styles";
import { env } from "@/lib/env";

interface EmailVerificationProps {
	verificationUrl: string;
	userName?: string;
}

export const EmailVerification = async ({ verificationUrl, userName }: EmailVerificationProps) => {
	const t = await getExtracted();
	return (
		<Html>
			<Head />
			<Preview>{t("Verify your email address")}</Preview>
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
					<Heading style={emailStyles.h1}>{t("Verify your email address")}</Heading>
					{userName ? (
						<Text style={emailStyles.text}>
							{t("Hi {name},", {
								name: userName,
							})}
						</Text>
					) : (
						<Text style={emailStyles.text}>{t("Hello,")}</Text>
					)}
					<Text style={emailStyles.text}>
						{t("Please click the button below to verify your email address.")}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={verificationUrl}>
							{t("Verify email")}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						{t("If you did not request verification, please ignore this email.")}
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default EmailVerification;
