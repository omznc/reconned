import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { getExtracted } from "next-intl/server";
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
	const t = await getExtracted();

	return (
		<Html>
			<Head />
			<Preview>
				{isExpired
					? t("{memberName}'s membership in {clubName} has expired", { memberName, clubName })
					: t("{memberName}'s membership in {clubName} expires in {days} days", {
							memberName,
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
						{isExpired ? t("Member's Subscription Expired") : t("Member's Subscription Expiring Soon")}
					</Heading>
					<Text style={emailStyles.text}>{t("Hello {name}", { name: ownerName })}</Text>
					<Text style={emailStyles.text}>
						{isExpired
							? t("The membership of {memberName} in your {clubName} club has expired on {date}.", {
									memberName,
									clubName,
									date: expiryDate,
								})
							: t(
									"The membership of {memberName} in your {clubName} club will expire on {date} (in {days} days).",
									{
										memberName,
										clubName,
										date: expiryDate,
										days: String(daysUntilExpiry),
									},
								)}
					</Text>
					<Section style={emailStyles.buttonContainer}>
						<Button style={emailStyles.button} href={membersUrl}>
							{t("Manage Members")}
						</Button>
					</Section>
					<Hr style={emailStyles.hr} />
					<Text style={emailStyles.footer}>
						{t("This is an automated notification to help you manage your club memberships.")}
					</Text>
				</Container>
			</Body>
		</Html>
	);
};
