import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Img,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import { emailStyles } from "@/emails/styles";
import { getTranslations } from "next-intl/server";

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
	const t = await getTranslations("emails.airsoftInvitation");

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
							alt="Logo Kluba"
							width="100"
							style={emailStyles.logo}
						/>
						<Heading style={emailStyles.clubName}>
							{clubName} - {clubLocation}
						</Heading>
					</Section>
					<Heading style={emailStyles.h1}>{t("invitation")}</Heading>
					{name ? (
						<Text style={emailStyles.text}>
							{t("helloUser", {
								name,
							})}
						</Text>
					) : (
						<Text style={emailStyles.text}>{t("hello")}</Text>
					)}
					<Text style={emailStyles.text}>
						{t("message", {
							clubName,
						})}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={url}>
							{t("action")}
						</Button>
					</Section>
					<Text style={emailStyles.text}>Ili koristite ovaj pozivni kod:</Text>
					<code style={emailStyles.code}>{code}</code>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{t("footer")}</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default ClubInvitationEmail;
