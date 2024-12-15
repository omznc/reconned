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

interface CreateAccountEmailProps {
	eventName: string;
	eventDate: string;
	signupUrl: string;
	inviteeEmail: string;
	clubLogo: string;
	clubName: string;
}

export const CreateAccountEmail = ({
	eventName,
	eventDate,
	signupUrl,
	inviteeEmail,
	clubLogo,
	clubName,
}: CreateAccountEmailProps) => {
	return (
		<Html>
			<Head />
			<Preview>
				Pozvani ste na airsoft susret! Kreirajte račun da biste se pridružili.
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
					</Section>
					<Heading style={emailStyles.h1}>
						Pozvani ste na airsoft susret!
					</Heading>
					<Text style={emailStyles.text}>
						Pozvani ste da se pridružite susretu {eventName} koji će se održati{" "}
						{eventDate}. Da biste potvrdili vaše učešće, potrebno je da kreirate
						račun na našoj platformi.
					</Text>
					<Text style={emailStyles.text}>
						Vaš račun će automatski biti povezan sa klubom {clubName} i moći
						ćete odmah pristupiti detaljima susreta.
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={signupUrl}>
							Kreiraj Račun
						</Button>
					</Section>
					<Text style={emailStyles.smallText}>
						Ovaj link je povezan sa email adresom: {inviteeEmail}
					</Text>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						Ako niste očekivali ovaj poziv, molimo vas da zanemarite ovaj email.
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default CreateAccountEmail;
