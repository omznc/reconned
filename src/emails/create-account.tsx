import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getTranslations } from "next-intl/server";
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
	const t = await getTranslations();

	return (
		<Html>
			<Head />
			<Preview>{t("emails.createAccount.title")}</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img
							src={clubLogo}
							alt={t("emails.createAccount.clubLogo")}
							width="100"
							style={emailStyles.logo}
						/>
					</Section>
					<Heading style={emailStyles.h1}>{t("emails.createAccount.invitationTitle")}</Heading>
					<Text style={emailStyles.text}>{t("emails.createAccount.message", { eventName, eventDate })}</Text>
					<Text style={emailStyles.text}>{t("emails.createAccount.clubMessage", { clubName })}</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={signupUrl}>
							{t("emails.createAccount.action")}
						</Button>
					</Section>
					<Text style={emailStyles.smallText}>
						{t("emails.createAccount.emailLinked", { email: inviteeEmail })}
					</Text>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{t("emails.createAccount.footer")}</Text>
				</Container>
			</Body>
		</Html>
	);
};
