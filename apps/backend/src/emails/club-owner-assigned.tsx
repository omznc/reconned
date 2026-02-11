import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getEmailMessages, interpolateMessage } from "../lib/email-messages";
import { env } from "../lib/env";
import { emailStyles } from "./styles";

interface ClubOwnerAssignedEmailProps {
	userName?: string;
	clubName: string;
	clubLogo: string | null;
	clubUrl: string;
	language?: "en" | "bs" | "sr";
}

export const ClubOwnerAssignedEmail = ({
	userName,
	clubName,
	clubLogo,
	clubUrl,
	language = "bs",
}: ClubOwnerAssignedEmailProps) => {
	const messages = getEmailMessages(language);
	return (
		<Html>
			<Head />
			<Preview>{interpolateMessage(messages.emails.clubOwnerAssigned.preview, { clubName })}</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						{clubLogo ? (
							<Img src={clubLogo} alt={clubName} width="100" style={emailStyles.logo} />
						) : (
							<Img
								src={`${env.FRONTEND_URL}/logo.png`}
								alt="RECONNED"
								width="150"
								style={emailStyles.logo}
							/>
						)}
					</Section>
					<Heading style={emailStyles.h1}>{messages.emails.clubOwnerAssigned.heading}</Heading>
					<Text style={emailStyles.text}>
						{userName
							? interpolateMessage(messages.emails.clubOwnerAssigned.greeting, { userName })
							: messages.emails.clubOwnerAssigned.greeting.replace("{userName}", "").trim()}
					</Text>
					<Text style={emailStyles.text}>
						{interpolateMessage(messages.emails.clubOwnerAssigned.description, { clubName })}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={clubUrl}>
							{messages.emails.clubOwnerAssigned.button}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{messages.emails.clubOwnerAssigned.footer}</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default ClubOwnerAssignedEmail;
