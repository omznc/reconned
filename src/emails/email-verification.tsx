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
			<Body style={main}>
				<Container style={container}>
					<Section style={logoSection}>
						<Img
							src={`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/logo.png`}
							alt="Logo"
							width="150"
							style={logo}
						/>
					</Section>
					<Heading style={h1}>Verifikacija Email Adrese</Heading>
					{userName ? (
						<Text style={text}>Pozdrav {userName},</Text>
					) : (
						<Text style={text}>Pozdrav,</Text>
					)}
					<Text style={text}>
						Molimo vas da kliknete na dugme ispod kako biste verifikovali vašu
						email adresu.
					</Text>
					<Section style={buttonContainer}>
						<Button style={button} href={verificationUrl}>
							Verifikuj Email
						</Button>
					</Section>
					<Hr style={hr} />
					<Text style={footer}>
						Ako niste očekivali ovaj email, molimo vas da zanemarite ga.
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default EmailVerification;

const main = {
	backgroundColor: "#ffffff",
	fontFamily:
		'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
	margin: "0 auto",
	padding: "20px 0 48px",
};

const h1 = {
	color: "#000000",
	fontSize: "24px",
	fontWeight: "bold",
	textAlign: "center" as const,
	margin: "30px 0",
	textTransform: "uppercase" as const,
};

const text = {
	color: "#000000",
	fontSize: "16px",
	lineHeight: "24px",
};

const buttonContainer = {
	textAlign: "center" as const,
	margin: "30px 0",
};

const button = {
	backgroundColor: "#000000",
	color: "#ffffff",
	fontSize: "16px",
	textDecoration: "none",
	textAlign: "center" as const,
	display: "inline-block",
	width: "200px",
	padding: "14px 0",
};

const hr = {
	borderColor: "#000000",
	margin: "20px 0",
};

const footer = {
	color: "#666666",
	fontSize: "12px",
	lineHeight: "16px",
	textAlign: "center" as const,
	marginTop: "30px",
};

const logoSection = {
	textAlign: "center" as const,
	marginBottom: "20px",
};

const logo = {
	margin: "0 auto",
};
