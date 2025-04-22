import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { env } from "@/lib/env";
import { emailStyles } from "@/emails/styles";
import { getTranslations } from "next-intl/server";

interface MembershipExpirationOwnerProps {
	ownerName: string;
	clubName: string;
	clubLogo: string;
	memberName: string;
	expiryDate: string;
	daysUntilExpiry: number;
	membersUrl: string;
	isExpired: boolean;
}

export const MembershipExpirationOwner = async ({
	ownerName,
	clubName,
	clubLogo,
	memberName,
	expiryDate,
	daysUntilExpiry,
	membersUrl,
	isExpired,
}: MembershipExpirationOwnerProps) => {
	const t = await getTranslations("emails.membershipExpirationOwner");

	return (
		<Html>
			<Head />
			<Preview>
				{isExpired
					? t("expiredTitle", { memberName, clubName })
					: t("expiringTitle", {
							memberName,
							clubName,
							days: daysUntilExpiry,
						})}
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
					<Heading style={emailStyles.h1}>{isExpired ? t("expiredHeading") : t("expiringHeading")}</Heading>
					<Text style={emailStyles.text}>{t("hello", { name: ownerName })}</Text>
					<Text style={emailStyles.text}>
						{isExpired
							? t("expiredMessage", {
									memberName,
									clubName,
									date: expiryDate,
								})
							: t("expiringMessage", {
									memberName,
									clubName,
									date: expiryDate,
									days: daysUntilExpiry,
								})}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={membersUrl}>
							{t("action")}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{t("footer")}</Text>
				</Container>
			</Body>
		</Html>
	);
};
