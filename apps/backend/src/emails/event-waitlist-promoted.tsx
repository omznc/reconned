import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getEmailMessages, interpolateMessage } from "../lib/email-messages";
import { emailStyles } from "./styles";

interface EventWaitlistPromotedEmailProps {
	eventName: string;
	eventDate: string;
	eventLocation: string;
	url: string;
	name?: string;
	clubLogo: string;
	clubName: string;
	language?: "en" | "bs" | "sr";
}

/**
 * A waiting place turning into a real one is the one thing on the waitlist the person cannot see
 * coming, so it is the one thing worth a mail.
 */
export const EventWaitlistPromotedEmail = ({
	eventName,
	eventDate,
	eventLocation,
	url,
	name,
	clubLogo,
	clubName,
	language = "bs",
}: EventWaitlistPromotedEmailProps) => {
	const messages = getEmailMessages(language);
	const copy = messages.emails.eventWaitlistPromoted;

	return (
		<Html>
			<Head />
			<Preview>{interpolateMessage(copy.preview, { eventName })}</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img src={clubLogo} alt="Club Logo" width="100" style={emailStyles.logo} />
						<Heading style={emailStyles.clubName}>{clubName}</Heading>
					</Section>
					<Heading style={emailStyles.h1}>{copy.heading}</Heading>
					<Text style={emailStyles.text}>
						{name ? interpolateMessage(copy.greeting, { name }) : copy.greetingGeneric}
					</Text>
					<Text style={emailStyles.text}>
						{interpolateMessage(copy.description, { eventName, eventDate, eventLocation })}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={url}>
							{copy.button}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{copy.footer}</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default EventWaitlistPromotedEmail;
