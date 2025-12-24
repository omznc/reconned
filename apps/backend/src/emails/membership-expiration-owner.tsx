import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getEmailMessages, interpolateMessage } from "../lib/email-messages";
import { env } from "../lib/env";
import { emailStyles } from "./styles";

interface MembershipExpirationOwnerProps {
	ownerName: string;
	clubName: string;
	clubLogo: string;
	memberName: string;
	expiryDate: string;
	daysUntilExpiry: number;
	membersUrl: string;
	isExpired: boolean;
	language?: "en" | "bs" | "sr";
}

export const MembershipExpirationOwner = ({
	ownerName,
	clubName,
	clubLogo,
	memberName,
	expiryDate,
	daysUntilExpiry,
	membersUrl,
	isExpired,
	language = "bs",
}: MembershipExpirationOwnerProps) => {
	const messages = getEmailMessages(language);
	return (
		<Html>
			<Head />
			<Preview>
				{isExpired
					? interpolateMessage(messages.emails.membershipExpirationOwner.previewExpired, {
							memberName,
							clubName,
						})
					: interpolateMessage(messages.emails.membershipExpirationOwner.previewExpiring, {
							memberName,
							clubName,
							daysUntilExpiry,
						})}
			</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img
							src={clubLogo || `${env.FRONTEND_URL}/logo.png`}
							alt="Club Logo"
							width="100"
							style={emailStyles.logo}
						/>
					</Section>
					<Heading style={emailStyles.h1}>
						{isExpired
							? messages.emails.membershipExpirationOwner.headingExpired
							: messages.emails.membershipExpirationOwner.headingExpiring}
					</Heading>
					<Text style={emailStyles.text}>
						{interpolateMessage(messages.emails.membershipExpirationOwner.greeting, { ownerName })}
					</Text>
					<Text style={emailStyles.text}>
						{isExpired
							? interpolateMessage(messages.emails.membershipExpirationOwner.descriptionExpired, {
									memberName,
									clubName,
									expiryDate,
								})
							: interpolateMessage(messages.emails.membershipExpirationOwner.descriptionExpiring, {
									memberName,
									clubName,
									expiryDate,
									daysUntilExpiry,
								})}
					</Text>
					<Text style={emailStyles.text}>{messages.emails.membershipExpirationOwner.actionNote}</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={membersUrl}>
							{messages.emails.membershipExpirationOwner.button}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{messages.emails.membershipExpirationOwner.footer}</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default MembershipExpirationOwner;
