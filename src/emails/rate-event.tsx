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

interface RateEventEmailProps {
	eventName: string;
	eventDate: string;
	rateUrl: string;
	playerName?: string;
	clubLogo: string;
	clubName: string;
}

export const RateEventEmail = ({
	eventName,
	eventDate,
	rateUrl,
	playerName,
	clubLogo,
	clubName,
}: RateEventEmailProps) => {
	return (
		<Html>
			<Head />
			<Preview>Ocjenite vaše iskustvo na susretu {eventName}!</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img
							src={clubLogo}
							alt="Logo Kluba"
							width="100"
							style={emailStyles.logo}
						/>
					</Section>
					<Heading style={emailStyles.h1}>Kako vam je bilo na susretu?</Heading>
					{playerName ? (
						<Text style={emailStyles.text}>Pozdrav {playerName},</Text>
					) : (
						<Text style={emailStyles.text}>Pozdrav,</Text>
					)}
					<Text style={emailStyles.text}>
						Hvala vam što ste prisustvovali susretu {eventName} održanom{" "}
						{eventDate}. Vaše mišljenje nam je važno i pomoći će nam da
						unaprijedimo buduće susrete.
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={rateUrl}>
							Ocijeni Susret
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						{clubName} - Hvala vam na vašem učešću!
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default RateEventEmail;
