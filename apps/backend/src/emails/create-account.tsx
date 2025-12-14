import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { emailStyles } from "./styles";

interface CreateAccountEmailProps {
	eventName: string;
	eventDate: string;
	signupUrl: string;
	inviteeEmail: string;
	clubLogo: string;
	clubName: string;
}

export const CreateAccountEmail = ({
	eventName,
	eventDate,
	signupUrl,
	inviteeEmail,
	clubLogo,
	clubName,
}: CreateAccountEmailProps) => {
	return (
		<Html>
			<Head />
			<Preview>You are invited to an airsoft event!</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img src={clubLogo} alt="Club Logo" width="100" style={emailStyles.logo} />
					</Section>
					<Heading style={emailStyles.h1}>You are invited to an airsoft event!</Heading>
					<Text style={emailStyles.text}>
						You are invited to join the {eventName} event that will take place on {eventDate}.
					</Text>
					<Text style={emailStyles.text}>
						Your account will automatically be linked to club {clubName} and you will be able to access
						match details immediately.
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={signupUrl}>
							Create Account
						</Button>
					</Section>
					<Text style={emailStyles.smallText}>
						This link is associated with the email address: {inviteeEmail}
					</Text>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						If you were not expecting this invitation, please ignore this email.
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default CreateAccountEmail;
