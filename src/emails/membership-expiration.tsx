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
import { getTranslations } from "next-intl/server";

interface MembershipExpirationProps {
	userName: string;
	clubName: string;
	clubLogo: string;
	expiryDate: string;
	daysUntilExpiry: number;
	renewUrl: string;
	isExpired: boolean;
}

export const MembershipExpiration = async ({
	userName,
	clubName,
	clubLogo,
	expiryDate,
	daysUntilExpiry,
	renewUrl,
	isExpired,
}: MembershipExpirationProps) => {
	const t = await getTranslations("emails.membershipExpiration");

	return (
		<Html>
			<Head />
			<Preview>
				{isExpired
					? t("expiredTitle", { clubName })
					: t("expiringTitle", { clubName, days: daysUntilExpiry })}
			</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img
							src={clubLogo || `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/logo.png`}
							alt="Logo Kluba"
							width="100"
							style={emailStyles.logo}
						/>
					</Section>
					<Heading style={emailStyles.h1}>
						{isExpired ? t("expiredHeading") : t("expiringHeading")}
					</Heading>
					<Text style={emailStyles.text}>{t("hello", { name: userName })}</Text>
					<Text style={emailStyles.text}>
						{isExpired
							? t("expiredMessage", { clubName, date: expiryDate })
							: t("expiringMessage", {
									clubName,
									date: expiryDate,
									days: daysUntilExpiry,
								})}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={renewUrl}>
							{t("action")}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{t("footer", { clubName })}</Text>
				</Container>
			</Body>
		</Html>
	);
};

export default MembershipExpiration;
