import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Img,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import { emailStyles } from "@/emails/styles";
import { getTranslations } from "next-intl/server";

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
	const t = await getTranslations("public.emails.createAccount");

	return (
		<Html>
			<Head />
			<Preview>{t('title')}</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img
							src={clubLogo}
							alt="Logo Kluba"
							width="100"
							style={emailStyles.logo}
						/>
					</Section>
					<Heading style={emailStyles.h1}>{t('invitationTitle')}</Heading>
					<Text style={emailStyles.text}>
						{t('message', { eventName, eventDate })}
					</Text>
					<Text style={emailStyles.text}>
						{t('clubMessage', { clubName })}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={signupUrl}>
							{t('action')}
						</Button>
					</Section>
					<Text style={emailStyles.smallText}>
						{t('emailLinked', { email: inviteeEmail })}
					</Text>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						{t('footer')}
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default CreateAccountEmail;
