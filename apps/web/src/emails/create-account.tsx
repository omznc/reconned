import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getExtracted } from "next-intl/server";
import { emailStyles } from "@/emails/styles";

interface CreateAccountEmailProps {
	eventName: string;
	eventDate: string;
	signupUrl: string;
	inviteeEmail: string;
	clubLogo: string;
	clubName: string;
}

export const CreateAccountEmail = async ({
	eventName,
	eventDate,
	signupUrl,
	inviteeEmail,
	clubLogo,
	clubName,
}: CreateAccountEmailProps) => {
	const t = await getExtracted();

	return (
		<Html>
			<Head />
			<Preview>{t("You are invited to an airsoft event! ")}</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img src={clubLogo} alt={t("Club Logo")} width="100" style={emailStyles.logo} />
					</Section>
					<Heading style={emailStyles.h1}>{t("You are invited to an airsoft event!")}</Heading>
					<Text style={emailStyles.text}>
						{t("You are invited to join the {eventName} event that will take place on {eventDate}. ", {
							eventName,
							eventDate,
						})}
					</Text>
					<Text style={emailStyles.text}>
						{t(
							"Your account will automatically be linked to club {clubName} and you will be able to access match details immediately.",
							{ clubName },
						)}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={signupUrl}>
							{t("Create Account")}
						</Button>
					</Section>
					<Text style={emailStyles.smallText}>
						{t("This link is associated with the email address: {email}", { email: inviteeEmail })}
					</Text>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						{t("If you were not expecting this invitation, please ignore this email.")}
					</Text>
				</Container>
			</Body>
		</Html>
	);
};
