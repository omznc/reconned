import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { emailStyles } from "./styles";

interface ClubInvitationEmailProps {
	code: string;
	url: string;
	name?: string;
	clubLogo: string;
	clubName: string;
	clubLocation: string;
}

export const ClubInvitationEmail = ({
	code,
	url,
	name,
	clubLogo,
	clubName,
	clubLocation,
}: ClubInvitationEmailProps) => {
	return (
		<Html>
			<Head />
			<Preview>You are invited to join the {clubName} club.</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img src={clubLogo} alt="Club Logo" width="100" style={emailStyles.logo} />
						<Heading style={emailStyles.clubName}>
							{clubName} - {clubLocation}
						</Heading>
					</Section>
					<Heading style={emailStyles.h1}>Invitation card</Heading>
					{name ? (
						<Text style={emailStyles.text}>Hi {name},</Text>
					) : (
						<Text style={emailStyles.text}>Hello,</Text>
					)}
					<Text style={emailStyles.text}>You are invited to join the {clubName} club.</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={url}>
							Accept invite
						</Button>
					</Section>
					<Text style={emailStyles.text}>Or use this invitation code:</Text>
					<code style={emailStyles.code}>{code}</code>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						If you did not expect this invitation, please ignore this email.
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default ClubInvitationEmail;
