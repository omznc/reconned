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
			<Body style={main}>
				<Container style={container}>
					<Section style={logoSection}>
						<Img src={clubLogo} alt="Logo Kluba" width="100" style={logo} />
						<Heading style={clubNameStyle}>
							{clubName} - {clubLocation}
						</Heading>
					</Section>
					<Heading style={h1}>Pozivnica</Heading>
					{name ? (
						<Text style={text}>Pozdrav {name},</Text>
					) : (
						<Text style={text}>Pozdrav,</Text>
					)}
					<Text style={text}>
						Pozvani ste da se pridružite klubu {clubName}. Radujemo se što ćemo
						vas vidjeti na terenu!
					</Text>
					<Section style={buttonContainer}>
						<Button style={button} href={url}>
							Prihvati Poziv
						</Button>
					</Section>
					<Text style={text}>Ili koristite ovaj pozivni kod:</Text>
					<code style={codeStyle}>{code}</code>
					<Hr style={hr} />
					<Text style={footer}>
						Ako niste očekivali ovu pozivnicu, molimo vas da zanemarite ovaj
						email.
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default ClubInvitationEmail;

const main = {
	backgroundColor: "#ffffff",
	fontFamily:
		'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
	margin: "0 auto",
	padding: "20px 0 48px",
};

const logoSection = {
	textAlign: "center" as const,
	marginBottom: "20px",
};

const logo = {
	margin: "0 auto",
};

const clubNameStyle = {
	color: "#000000",
	fontSize: "24px",
	fontWeight: "bold",
	textAlign: "center" as const,
	margin: "20px 0 0",
};

const h1 = {
	color: "#000000",
	fontSize: "24px",
	fontWeight: "bold",
	textAlign: "center" as const,
	margin: "30px 0",
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

const codeStyle = {
	display: "block",
	width: "100%",
	padding: "16px 0",
	backgroundColor: "#ffffff",
	border: "1px solid #000000",
	color: "#000000",
	fontSize: "18px",
	textAlign: "center" as const,
	margin: "10px 0",
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
