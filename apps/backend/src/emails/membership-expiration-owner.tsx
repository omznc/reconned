import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
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
}: MembershipExpirationOwnerProps) => {
	return (
		<Html>
			<Head />
			<Preview>
				{isExpired
					? `${memberName}'s membership in ${clubName} has expired`
					: `${memberName}'s membership in ${clubName} expires in ${daysUntilExpiry} days`}
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
						{isExpired ? "Member's Subscription Expired" : "Member's Subscription Expiring Soon"}
					</Heading>
					<Text style={emailStyles.text}>Hello {ownerName}</Text>
					<Text style={emailStyles.text}>
						{isExpired
							? `The membership of ${memberName} in your ${clubName} club has expired on ${expiryDate}.`
							: `The membership of ${memberName} in your ${clubName} club will expire on ${expiryDate} (in ${daysUntilExpiry} days).`}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={membersUrl}>
							Manage Members
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						This is an automated notification to help you manage your club memberships.
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default MembershipExpirationOwner;
