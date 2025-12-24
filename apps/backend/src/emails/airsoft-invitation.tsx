import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getEmailMessages, interpolateMessage } from "../lib/email-messages";
import { emailStyles } from "./styles";

interface ClubInvitationEmailProps {
	code: string;
	url: string;
	name?: string;
	clubLogo: string;
	clubName: string;
	clubLocation: string;
	language?: "en" | "bs" | "sr";
}

export const ClubInvitationEmail = ({
	code,
	url,
	name,
	clubLogo,
	clubName,
	clubLocation,
	language = "bs",
}: ClubInvitationEmailProps) => {
	const messages = getEmailMessages(language);
	return (
		<Html>
			<Head />
			<Preview>{interpolateMessage(messages.emails.clubInvitation.preview, { clubName })}</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img src={clubLogo} alt="Club Logo" width="100" style={emailStyles.logo} />
						<Heading style={emailStyles.clubName}>
							{clubName} - {clubLocation}
						</Heading>
					</Section>
					<Heading style={emailStyles.h1}>{messages.emails.clubInvitation.heading}</Heading>
					<Text style={emailStyles.text}>
						{name
							? interpolateMessage(messages.emails.clubInvitation.greeting, { name })
							: messages.emails.clubInvitation.greetingGeneric}
					</Text>
					<Text style={emailStyles.text}>
						{interpolateMessage(messages.emails.clubInvitation.description, { clubName })}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={url}>
							{messages.emails.clubInvitation.button}
						</Button>
					</Section>
					<Text style={emailStyles.text}>{messages.emails.clubInvitation.codeNote}</Text>
					<code style={emailStyles.code}>{code}</code>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{messages.emails.clubInvitation.footer}</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default ClubInvitationEmail;
