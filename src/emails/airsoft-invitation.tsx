import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getExtracted } from "next-intl/server";
import { emailStyles } from "@/emails/styles";

interface ClubInvitationEmailProps {
	code: string;
	url: string;
	name?: string;
	clubLogo: string;
	clubName: string;
	clubLocation: string;
}

export const ClubInvitationEmail = async ({
	code,
	url,
	name,
	clubLogo,
	clubName,
	clubLocation,
}: ClubInvitationEmailProps) => {
	const t = await getExtracted();

	return (
		<Html>
			<Head />
			<Preview>
				{t("You are invited to join the {clubName} club.", {
					clubName,
				})}
			</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img src={clubLogo} alt={t("Club Logo")} width="100" style={emailStyles.logo} />
						<Heading style={emailStyles.clubName}>
							{clubName} - {clubLocation}
						</Heading>
					</Section>
					<Heading style={emailStyles.h1}>{t("Invitation card")}</Heading>
					{name ? (
						<Text style={emailStyles.text}>
							{t("Hi {name},", {
								name,
							})}
						</Text>
					) : (
						<Text style={emailStyles.text}>{t("Hello,")}</Text>
					)}
					<Text style={emailStyles.text}>
						{t("You are invited to join the {clubName} club. ", {
							clubName,
						})}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={url}>
							{t("Accept invite")}
						</Button>
					</Section>
					<Text style={emailStyles.text}>{t("Or use this invitation code:")}</Text>
					<code style={emailStyles.code}>{code}</code>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						{t("If you did not expect this invitation, please ignore this email.")}
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default ClubInvitationEmail;
