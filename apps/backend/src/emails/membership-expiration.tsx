import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getEmailMessages, interpolateMessage } from "../lib/email-messages";
import { env } from "../lib/env";
import { emailStyles } from "./styles";

interface MembershipExpirationProps {
	userName: string;
	clubName: string;
	clubLogo: string;
	expiryDate: string;
	daysUntilExpiry: number;
	renewUrl: string;
	isExpired: boolean;
	language?: "en" | "bs" | "sr";
}

export const MembershipExpiration = ({
	userName,
	clubName,
	clubLogo,
	expiryDate,
	daysUntilExpiry,
	renewUrl,
	isExpired,
	language = "bs",
}: MembershipExpirationProps) => {
	const messages = getEmailMessages(language);
	return (
		<Html>
			<Head />
			<Preview>
				{isExpired
					? interpolateMessage(messages.emails.membershipExpiration.previewExpired, { clubName })
					: interpolateMessage(messages.emails.membershipExpiration.previewExpiring, {
							clubName,
							daysUntilExpiry,
						})}
			</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img
							src={clubLogo || `${env.BETTER_AUTH_URL}/logo.png`}
							alt="Club Logo"
							width="100"
							style={emailStyles.logo}
						/>
					</Section>
					<Heading style={emailStyles.h1}>
						{isExpired
							? messages.emails.membershipExpiration.headingExpired
							: messages.emails.membershipExpiration.headingExpiring}
					</Heading>
					<Text style={emailStyles.text}>
						{interpolateMessage(messages.emails.membershipExpiration.greeting, { userName })}
					</Text>
					<Text style={emailStyles.text}>
						{isExpired
							? interpolateMessage(messages.emails.membershipExpiration.descriptionExpired, {
									clubName,
									expiryDate,
								})
							: interpolateMessage(messages.emails.membershipExpiration.descriptionExpiring, {
									clubName,
									expiryDate,
									daysUntilExpiry,
								})}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={renewUrl}>
							{messages.emails.membershipExpiration.button}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						{interpolateMessage(messages.emails.membershipExpiration.footer, { clubName })}
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default MembershipExpiration;
