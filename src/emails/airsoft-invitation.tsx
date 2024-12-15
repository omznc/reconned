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

interface ClubInvitationEmailProps {
	code: string;
	url: string;
	name?: string;
	clubLogo: string;
	clubName: string;
	clubLocation: string;
}

export const ClubInvitationEmail = ({
	code,
	url,
	name,
	clubLogo,
	clubName,
	clubLocation,
}: ClubInvitationEmailProps) => {
	return (
		<Html>
			<Head />
			<Preview>Pozvani ste da se pridružite Taktičkom Airsoft Klubu!</Preview>
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
					<Heading style={emailStyles.h1}>Pozivnica</Heading>
					{name ? (
						<Text style={emailStyles.text}>Pozdrav {name},</Text>
					) : (
						<Text style={emailStyles.text}>Pozdrav,</Text>
					)}
					<Text style={emailStyles.text}>
						Pozvani ste da se pridružite klubu {clubName}. Radujemo se što ćemo
						vas vidjeti na terenu!
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={url}>
							Prihvati Poziv
						</Button>
					</Section>
					<Text style={emailStyles.text}>Ili koristite ovaj pozivni kod:</Text>
					<code style={emailStyles.code}>{code}</code>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						Ako niste očekivali ovu pozivnicu, molimo vas da zanemarite ovaj
						email.
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default ClubInvitationEmail;
