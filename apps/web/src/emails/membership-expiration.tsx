import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getExtracted } from "next-intl/server";
import { emailStyles } from "@/emails/styles";
import { env } from "@/lib/env";

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
	const t = await getExtracted();

	return (
		<Html>
			<Head />
			<Preview>
				{isExpired
					? t("Your membership in {clubName} has expired", { clubName })
					: t("Your membership in {clubName} expires in {days} days", {
							clubName,
							days: String(daysUntilExpiry),
						})}
			</Preview>
			<Body style={emailStyles.main}>
				<Container style={emailStyles.container}>
					<Section style={emailStyles.logoSection}>
						<Img
							src={clubLogo || `${env.NEXT_PUBLIC_WEB_URL}/logo.png`}
							alt={t("Club Logo")}
							width="100"
							style={emailStyles.logo}
						/>
					</Section>
					<Heading style={emailStyles.h1}>
						{isExpired ? t("Membership Expired") : t("Membership Expiring Soon")}
					</Heading>
					<Text style={emailStyles.text}>{t("Hello {name},", { name: userName })}</Text>
					<Text style={emailStyles.text}>
						{isExpired
							? t(
									"Your membership in the {clubName} club has expired on {date}. If you wish to continue being a club member, please renew your membership.",
									{
										clubName,
										date: expiryDate,
									},
								)
							: t(
									"Your membership in the {clubName} club will expire on {date} (in {days} days). To ensure continuous membership, please consider renewing before the expiry date.",
									{
										clubName,
										date: expiryDate,
										days: String(daysUntilExpiry),
									},
								)}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={renewUrl}>
							{t("Renew Membership")}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						{t("If you no longer wish to be a member of {clubName}, you can ignore this email.", {
							clubName,
						})}
					</Text>
				</Container>
			</Body>
		</Html>
	);
};
