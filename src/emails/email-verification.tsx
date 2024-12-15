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
import { env } from "@/lib/env";
import { emailStyles } from "@/emails/styles";

interface EmailVerificationProps {
	verificationUrl: string;
	userName?: string;
}

export const EmailVerification = ({
	verificationUrl,
	userName,
}: EmailVerificationProps) => {
	return (
		<Html>
			<Head />
			<Preview>Verifikujte vašu email adresu</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img
							src={`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/logo.png`}
							alt="Logo"
							width="150"
							style={emailStyles.logo}
						/>
					</Section>
					<Heading style={emailStyles.h1}>Verifikacija Email Adrese</Heading>
					{userName ? (
						<Text style={emailStyles.text}>Pozdrav {userName},</Text>
					) : (
						<Text style={emailStyles.text}>Pozdrav,</Text>
					)}
					<Text style={emailStyles.text}>
						Molimo vas da kliknete na dugme ispod kako biste verifikovali vašu
						email adresu.
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={verificationUrl}>
							Verifikuj Email
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						Ako niste očekivali ovaj email, molimo vas da ga zanemarite.
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default EmailVerification;
