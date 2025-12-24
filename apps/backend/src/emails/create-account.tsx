import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getEmailMessages, interpolateMessage } from "../lib/email-messages";
import { emailStyles } from "./styles";

interface CreateAccountEmailProps {
	eventName: string;
	eventDate: string;
	signupUrl: string;
	inviteeEmail: string;
	clubLogo: string;
	clubName: string;
	language?: "en" | "bs" | "sr";
}

export const CreateAccountEmail = ({
	eventName,
	eventDate,
	signupUrl,
	inviteeEmail,
	clubLogo,
	clubName,
	language = "bs",
}: CreateAccountEmailProps) => {
	const messages = getEmailMessages(language);
	return (
		<Html>
			<Head />
			<Preview>{messages.emails.createAccount.preview}</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img src={clubLogo} alt="Club Logo" width="100" style={emailStyles.logo} />
					</Section>
					<Heading style={emailStyles.h1}>{messages.emails.createAccount.heading}</Heading>
					<Text style={emailStyles.text}>
						{interpolateMessage(messages.emails.createAccount.description, { eventName, eventDate })}
					</Text>
					<Text style={emailStyles.text}>
						{interpolateMessage(messages.emails.createAccount.accountLink, { clubName })}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={signupUrl}>
							{messages.emails.createAccount.button}
						</Button>
					</Section>
					<Text style={emailStyles.smallText}>
						{interpolateMessage(messages.emails.createAccount.emailNote, { email: inviteeEmail })}
					</Text>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{messages.emails.createAccount.footer}</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default CreateAccountEmail;
