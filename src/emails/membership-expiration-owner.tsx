import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getTranslations } from "next-intl/server";
import { emailStyles } from "@/emails/styles";
import { env } from "@/lib/env";

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
	const t = await getTranslations();

	return (
		<Html>
			<Head />
			<Preview>
				{isExpired
					? t("emails.membershipExpirationOwner.expiredTitle", { memberName, clubName })
					: t("emails.membershipExpirationOwner.expiringTitle", {
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
					<Heading style={emailStyles.h1}>
						{isExpired
							? t("emails.membershipExpirationOwner.expiredHeading")
							: t("emails.membershipExpirationOwner.expiringHeading")}
					</Heading>
					<Text style={emailStyles.text}>{t("hello", { name: ownerName })}</Text>
					<Text style={emailStyles.text}>
						{isExpired
							? t("emails.membershipExpirationOwner.expiredMessage", {
									memberName,
									clubName,
									date: expiryDate,
								})
							: t("emails.membershipExpirationOwner.expiringMessage", {
									memberName,
									clubName,
									date: expiryDate,
									days: daysUntilExpiry,
								})}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={membersUrl}>
							{t("emails.membershipExpirationOwner.action")}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>{t("emails.membershipExpirationOwner.footer")}</Text>
				</Container>
			</Body>
		</Html>
	);
};
