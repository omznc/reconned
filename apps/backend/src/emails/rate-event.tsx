import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getEmailMessages, interpolateMessage } from "../lib/email-messages";
import { emailStyles } from "./styles";

interface RateEventEmailProps {
	eventName: string;
	eventDate: string;
	rateUrl: string;
	playerName?: string;
	clubLogo: string;
	clubName: string;
	language?: "en" | "bs" | "sr";
}

export const RateEventEmail = ({
	eventName,
	eventDate,
	rateUrl,
	playerName,
	clubLogo,
	clubName,
	language = "bs",
}: RateEventEmailProps) => {
	const messages = getEmailMessages(language);
	return (
		<Html>
			<Head />
			<Preview>{interpolateMessage(messages.emails.rateEvent.preview, { eventName })}</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img src={clubLogo} alt="Club Logo" width="100" style={emailStyles.logo} />
					</Section>
					<Heading style={emailStyles.h1}>{messages.emails.rateEvent.heading}</Heading>
					<Text style={emailStyles.text}>
						{playerName
							? interpolateMessage(messages.emails.rateEvent.greeting, { playerName })
							: messages.emails.rateEvent.greetingGeneric}
					</Text>
					<Text style={emailStyles.text}>
						{interpolateMessage(messages.emails.rateEvent.description, { eventName, eventDate })}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={rateUrl}>
							{messages.emails.rateEvent.button}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						{interpolateMessage(messages.emails.rateEvent.footer, { clubName })}
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default RateEventEmail;
