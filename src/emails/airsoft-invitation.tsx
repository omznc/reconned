import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getTranslations } from "next-intl/server";
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
	const t = await getTranslations();

	return (
		<Html>
			<Head />
			<Preview>
				{t("title", {
					clubName,
				})}
			</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img
							src={clubLogo}
							alt={t("emails.airsoftInvitation.clubLogo")}
							width="100"
							style={emailStyles.logo}
						/>
						<Heading style={emailStyles.clubName}>
							{clubName} - {clubLocation}
						</Heading>
					</Section>
					<Heading style={emailStyles.h1}>{t("emails.airsoftInvitation.invitation")}</Heading>
					{name ? (
						<Text style={emailStyles.text}>
							{t("emails.airsoftInvitation.helloUser", {
								name,
							})}
						</Text>
					) : (
						<Text style={emailStyles.text}>{t("emails.airsoftInvitation.hello")}</Text>
					)}
					<Text style={emailStyles.text}>
						{t("emails.airsoftInvitation.message", {
							clubName,
						})}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={url}>
							{t("emails.airsoftInvitation.action")}
						</Button>
					</Section>
					<Text style={emailStyles.text}>{t("emails.airsoftInvitation.invitationCode")}</Text>
					<code style={emailStyles.code}>{code}</code>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{t("emails.airsoftInvitation.footer")}</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default ClubInvitationEmail;
