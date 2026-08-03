import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getEmailMessages, interpolateMessage } from "../lib/email-messages";
import { emailStyles } from "./styles";

interface EventInvitationEmailProps {
	eventName: string;
	eventDate: string;
	eventLocation: string;
	leaderName: string;
	url: string;
	name?: string;
	clubLogo: string;
	clubName: string;
	/**
	 * Guests were put on the roster by the person who booked and already hold a place, so their
	 * mail confirms rather than asks. Members still have to accept before they count.
	 */
	isGuest?: boolean;
	language?: "en" | "bs" | "sr";
}

export const EventInvitationEmail = ({
	eventName,
	eventDate,
	eventLocation,
	leaderName,
	url,
	name,
	clubLogo,
	clubName,
	isGuest = false,
	language = "bs",
}: EventInvitationEmailProps) => {
	const messages = getEmailMessages(language);
	const copy = messages.emails.eventInvitation;

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
					<Heading style={emailStyles.h1}>{isGuest ? copy.guestHeading : copy.heading}</Heading>
					<Text style={emailStyles.text}>
						{name ? interpolateMessage(copy.greeting, { name }) : copy.greetingGeneric}
					</Text>
					<Text style={emailStyles.text}>
						{interpolateMessage(copy.description, { leaderName, eventName, eventDate, eventLocation })}
					</Text>
					<Text style={emailStyles.text}>{isGuest ? copy.guestNote : copy.memberNote}</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={url}>
							{isGuest ? copy.guestButton : copy.button}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{copy.footer}</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default EventInvitationEmail;
