import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getExtracted } from "next-intl/server";
import { emailStyles } from "@/emails/styles";

interface RateEventEmailProps {
	eventName: string;
	eventDate: string;
	rateUrl: string;
	playerName?: string;
	clubLogo: string;
	clubName: string;
}

export const RateEventEmail = async ({
	eventName,
	eventDate,
	rateUrl,
	playerName,
	clubLogo,
	clubName,
}: RateEventEmailProps) => {
	const t = await getExtracted();

	return (
		<Html>
			<Head />
			<Preview>{t("Rate your experience at {eventName}!", { eventName })}</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img src={clubLogo} alt={t("Club Logo")} width="100" style={emailStyles.logo} />
					</Section>
					<Heading style={emailStyles.h1}>{t("How was your event?")}</Heading>
					{playerName ? (
						<Text style={emailStyles.text}>{t("Hello {name},", { name: playerName })}</Text>
					) : (
						<Text style={emailStyles.text}>{t("Greetings,")}</Text>
					)}
					<Text style={emailStyles.text}>
						{t("Thank you for attending the {eventName} event held on {date}. ", {
							eventName,
							date: eventDate,
						})}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={rateUrl}>
							{t("Rate the event")}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						{t("{clubName} - Thank you for your participation!", { clubName })}
					</Text>
				</Container>
			</Body>
		</Html>
	);
};
