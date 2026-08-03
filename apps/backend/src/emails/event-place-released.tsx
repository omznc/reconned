import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getEmailMessages, interpolateMessage } from "../lib/email-messages";
import { emailStyles } from "./styles";

interface EventPlaceReleasedEmailProps {
	eventName: string;
	eventDate: string;
	eventLocation: string;
	leaderName: string;
	url: string;
	name?: string;
	clubLogo: string;
	clubName: string;
	language?: "en" | "bs" | "sr";
}

/**
 * Somebody was taken off a team by the person who booked it. They never asked for this and the app
 * will not tell them on its own, so without this mail they turn up to an event they are no longer
 * on the roster for.
 */
export const EventPlaceReleasedEmail = ({
	eventName,
	eventDate,
	eventLocation,
	leaderName,
	url,
	name,
	clubLogo,
	clubName,
	language = "bs",
}: EventPlaceReleasedEmailProps) => {
	const messages = getEmailMessages(language);
	const copy = messages.emails.eventPlaceReleased;

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
						{interpolateMessage(copy.description, { leaderName, eventName, eventDate, eventLocation })}
					</Text>
					<Text style={emailStyles.text}>{copy.note}</Text>
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

export default EventPlaceReleasedEmail;
