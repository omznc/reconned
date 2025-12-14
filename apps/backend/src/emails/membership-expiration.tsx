import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
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
}

export const MembershipExpiration = ({
	userName,
	clubName,
	clubLogo,
	expiryDate,
	daysUntilExpiry,
	renewUrl,
	isExpired,
}: MembershipExpirationProps) => {
	return (
		<Html>
			<Head />
			<Preview>
				{isExpired
					? `Your membership in ${clubName} has expired`
					: `Your membership in ${clubName} expires in ${daysUntilExpiry} days`}
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
						{isExpired ? "Membership Expired" : "Membership Expiring Soon"}
					</Heading>
					<Text style={emailStyles.text}>Hello {userName},</Text>
					<Text style={emailStyles.text}>
						{isExpired
							? `Your membership in the ${clubName} club has expired on ${expiryDate}. If you wish to continue being a club member, please renew your membership.`
							: `Your membership in the ${clubName} club will expire on ${expiryDate} (in ${daysUntilExpiry} days). To ensure continuous membership, please consider renewing before the expiry date.`}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={renewUrl}>
							Renew Membership
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						If you no longer wish to be a member of {clubName}, you can ignore this email.
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default MembershipExpiration;
