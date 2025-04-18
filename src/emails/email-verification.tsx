import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { env } from "@/lib/env";
import { emailStyles } from "@/emails/styles";
import { getTranslations } from "next-intl/server";

interface EmailVerificationProps {
	verificationUrl: string;
	userName?: string;
}

export const EmailVerification = async ({ verificationUrl, userName }: EmailVerificationProps) => {
	const t = await getTranslations("emails.emailVerification");
	return (
		<Html>
			<Head />
			<Preview>{t("title")}</Preview>
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
					<Heading style={emailStyles.h1}>{t("title")}</Heading>
					{userName ? (
						<Text style={emailStyles.text}>
							{t("helloUser", {
								name: userName,
							})}
						</Text>
					) : (
						<Text style={emailStyles.text}>{t("hello")}</Text>
					)}
					<Text style={emailStyles.text}>{t("message")}</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={verificationUrl}>
							{t("action")}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{t("footer")}</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default EmailVerification;
