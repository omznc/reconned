import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getTranslations } from "next-intl/server";
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
	const t = await getTranslations();
	const adminUrl = `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/dashboard/admin/unclaimed-clubs?clubId=${clubId}`;

	return (
		<Html>
			<Head />
			<Preview>{t("emails.clubClaimRequest.title", { clubName })}</Preview>
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
					<Heading style={emailStyles.h1}>{t("emails.clubClaimRequest.title", { clubName })}</Heading>
					<Text style={emailStyles.text}>{t("emails.clubClaimRequest.message")}</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={adminUrl}>
							{t("emails.clubClaimRequest.action")}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.text}>
						<strong>{t("emails.clubClaimRequest.requesterName")}:</strong> {requesterName}
						{requesterCallsign && ` (${requesterCallsign})`}
					</Text>
					<Text style={emailStyles.text}>
						<strong>{t("emails.clubClaimRequest.requesterEmail")}:</strong> {requesterEmail}
					</Text>
					<Text style={emailStyles.text}>
						<strong>{t("emails.clubClaimRequest.club")}:</strong> {clubName}
					</Text>
					<Text style={emailStyles.text}>
						<strong>{t("emails.clubClaimRequest.clubId")}:</strong> {clubId}
					</Text>
					{message && (
						<>
							<Hr style={emailStyles.hr} />
							<Text style={emailStyles.text}>
								<strong>{t("emails.clubClaimRequest.messageLabel")}:</strong>
							</Text>
							<Text style={emailStyles.text}>{message}</Text>
						</>
					)}
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{t("emails.clubClaimRequest.footer")}</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default ClubClaimRequestEmail;
