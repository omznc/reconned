import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { emailStyles } from "./styles";

interface RateEventEmailProps {
	eventName: string;
	eventDate: string;
	rateUrl: string;
	playerName?: string;
	clubLogo: string;
	clubName: string;
}

export const RateEventEmail = ({
	eventName,
	eventDate,
	rateUrl,
	playerName,
	clubLogo,
	clubName,
}: RateEventEmailProps) => {
	return (
		<Html>
			<Head />
			<Preview>Rate your experience at {eventName}!</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img src={clubLogo} alt="Club Logo" width="100" style={emailStyles.logo} />
					</Section>
					<Heading style={emailStyles.h1}>How was your event?</Heading>
					{playerName ? (
						<Text style={emailStyles.text}>Hello {playerName},</Text>
					) : (
						<Text style={emailStyles.text}>Greetings,</Text>
					)}
					<Text style={emailStyles.text}>
						Thank you for attending the {eventName} event held on {eventDate}.
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={rateUrl}>
							Rate the event
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{clubName} - Thank you for your participation!</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default RateEventEmail;
