import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getExtracted } from "next-intl/server";
import { emailStyles } from "@/emails/styles";
import { env } from "@/lib/env";

interface ClubClaimRequestEmailProps {
	clubName: string;
	clubLogo: string | null;
	clubLocation: string | null;
	requesterName: string;
	requesterEmail: string;
	requesterCallsign: string | null;
	message: string | null;
	clubId: string;
}

export const ClubClaimRequestEmail = async ({
	clubName,
	clubLogo,
	clubLocation,
	requesterName,
	requesterEmail,
	requesterCallsign,
	message,
	clubId,
}: ClubClaimRequestEmailProps) => {
	const t = await getExtracted();
	const adminUrl = `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/dashboard/admin/unclaimed-clubs?clubId=${clubId}`;

	return (
		<Html>
			<Head />
			<Preview>{t("Club Claim Request: {clubName}", { clubName })}</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						{clubLogo ? (
							<Img src={clubLogo} alt={clubName} width="100" style={emailStyles.logo} />
						) : (
							<Img
								src={`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/logo.png`}
								alt="RECONNED"
								width="150"
								style={emailStyles.logo}
							/>
						)}
						<Heading style={emailStyles.clubName}>
							{clubName}
							{clubLocation && ` - ${clubLocation}`}
						</Heading>
					</Section>
					<Heading style={emailStyles.h1}>{t("Club Claim Request: {clubName}", { clubName })}</Heading>
					<Text style={emailStyles.text}>
						{t(
							"A user has requested to claim an unclaimed club. Review the details below and assign an owner if appropriate.",
						)}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={adminUrl}>
							{t("View Club in Admin Panel")}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.text}>
						<strong>{t("Requester Name")}:</strong> {requesterName}
						{requesterCallsign && ` (${requesterCallsign})`}
					</Text>
					<Text style={emailStyles.text}>
						<strong>{t("Requester Email")}:</strong> {requesterEmail}
					</Text>
					<Text style={emailStyles.text}>
						<strong>{t("Club")}:</strong> {clubName}
					</Text>
					<Text style={emailStyles.text}>
						<strong>{t("Club ID")}:</strong> {clubId}
					</Text>
					{message && (
						<>
							<Hr style={emailStyles.hr} />
							<Text style={emailStyles.text}>
								<strong>{t("Message")}:</strong>
							</Text>
							<Text style={emailStyles.text}>{message}</Text>
						</>
					)}
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{t("This is an automated notification from RECONNED.")}</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default ClubClaimRequestEmail;
