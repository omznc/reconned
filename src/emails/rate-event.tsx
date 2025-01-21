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
	const t = await getTranslations("public.emails.rateEvent");

	return (
		<Html>
			<Head />
			<Preview>{t('title', { eventName })}</Preview>
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
					<Heading style={emailStyles.h1}>{t('heading')}</Heading>
					{playerName ? (
						<Text style={emailStyles.text}>{t('helloUser', { name: playerName })}</Text>
					) : (
						<Text style={emailStyles.text}>{t('hello')}</Text>
					)}
					<Text style={emailStyles.text}>
						{t('message', { eventName, date: eventDate })}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={rateUrl}>
							{t('action')}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						{t('footer', { clubName })}
					</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default RateEventEmail;
