import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";

const emailStyles = {
	main: {
		backgroundColor: "#ffffff",
		fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
	},
	container: {
		margin: "0 auto",
		padding: "20px 0 48px",
	},
	logoSection: {
		textAlign: "center" as const,
		marginBottom: "20px",
	},
	logo: {
		margin: "0 auto",
	},
	h1: {
		color: "#000000",
		fontSize: "24px",
		fontWeight: "bold",
		textAlign: "center" as const,
		margin: "30px 0",
	},
	text: {
		color: "#000000",
		fontSize: "16px",
		lineHeight: "24px",
	},
	buttonContainer: {
		textAlign: "center" as const,
		margin: "30px 0",
	},
	button: {
		backgroundColor: "#000000",
		color: "#ffffff",
		fontSize: "16px",
		textDecoration: "none",
		textAlign: "center" as const,
		display: "inline-block",
		width: "200px",
		padding: "14px 0",
	},
	hr: {
		borderColor: "#000000",
		margin: "20px 0",
	},
	footer: {
		color: "#666666",
		fontSize: "12px",
		lineHeight: "16px",
		textAlign: "center" as const,
		marginTop: "30px",
	},
};

interface EmailVerificationProps {
	verificationUrl: string;
	userName?: string;
	logoUrl: string;
}

export const EmailVerification = ({ verificationUrl, userName, logoUrl }: EmailVerificationProps) => {
	return (
		<Html>
			<Head />
			<Preview>Verify your email address</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img src={logoUrl} alt="Logo" width="150" style={emailStyles.logo} />
					</Section>
					<Heading style={emailStyles.h1}>Verify your email address</Heading>
					{userName ? (
						<Text style={emailStyles.text}>Hi {userName},</Text>
					) : (
						<Text style={emailStyles.text}>Hello,</Text>
					)}
					<Text style={emailStyles.text}>Please click the button below to verify your email address.</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={verificationUrl}>
							Verify email
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						If you did not request verification, please ignore this email.
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default EmailVerification;
