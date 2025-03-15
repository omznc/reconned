import { ClubInvitationEmail } from "@/emails/airsoft-invitation";
import { CreateAccountEmail } from "@/emails/create-account";
import { EmailVerification } from "@/emails/email-verification";
import { PasswordReset } from "@/emails/password-reset";
import { RateEventEmail } from "@/emails/rate-event";
import { EmailSheet } from "./_components/email-sheet";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Mail } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { render } from "@react-email/components";
import { cn } from "@/lib/utils";

const SAMPLE_CLUB = {
	name: "Moj airsoft klub",
	logo: "https://placehold.co/100x100",
	location: "Sarajevo",
};

const emails = [
	{
		id: "club-invitation",
		name: "Pozivnica za klub",
		description: "Email koji se šalje kada neko pozove igrača u klub",
		preview: ClubInvitationEmail,
		sampleData: {
			code: "ABC123",
			url: "#",
			name: "John Doe",
			clubLogo: SAMPLE_CLUB.logo,
			clubName: SAMPLE_CLUB.name,
			clubLocation: SAMPLE_CLUB.location,
		},
	},
	{
		id: "create-account",
		name: "Kreiranje računa",
		description:
			"Email koji se šalje kada je neko pozvan na susret a nema račun",
		preview: CreateAccountEmail,
		sampleData: {
			eventName: "Spring Game 2024",
			eventDate: "21.04.2024",
			signupUrl: "#",
			inviteeEmail: "john@example.com",
			clubLogo: SAMPLE_CLUB.logo,
			clubName: SAMPLE_CLUB.name,
		},
	},
	{
		id: "email-verification",
		name: "Verifikacija email adrese",
		description: "Email koji se šalje za verifikaciju email adrese",
		preview: EmailVerification,
		sampleData: {
			verificationUrl: "#",
			userName: "John Doe",
		},
	},
	{
		id: "password-reset",
		name: "Reset lozinke",
		description: "Email koji se šalje za resetovanje lozinke",
		preview: PasswordReset,
		sampleData: {
			resetUrl: "#",
			userName: "John Doe",
		},
	},
	{
		id: "rate-event",
		name: "Ocjena susreta",
		description: "Email koji se šalje nakon susreta za ocjenjivanje",
		preview: RateEventEmail,
		sampleData: {
			eventName: "Spring Game 2024",
			eventDate: "21.04.2024",
			rateUrl: "#",
			playerName: "John Doe",
			clubLogo: SAMPLE_CLUB.logo,
			clubName: SAMPLE_CLUB.name,
		},
	},
];

type Props = {
	searchParams: Promise<{
		email?: string;
	}>;
};

export default async function Page(props: Props) {
	const searchParams = await props.searchParams;
	const selectedEmail = emails.find((email) => email.id === searchParams.email);

	return (
		<div className="container py-6">
			<div className="flex flex-col gap-4">
				<div>
					<h1 className="text-3xl font-bold">Email-ovi</h1>
					<p className="text-muted-foreground">
						Pregled svih email template-ova u sistemu
					</p>
				</div>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{emails.map((email) => (
						<Link
							href={`?email=${email.id}`}
							key={email.id}
							className="block h-[250px]"
						>
							<Card
								className={cn(
									"group relative h-full overflow-hidden transition-all duration-300 hover:-translate-y-1",
									selectedEmail?.id === email.id && "ring-2 ring-primary",
								)}
							>
								<div className="flex h-full flex-col">
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<Mail className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
											{email.name}
										</CardTitle>
									</CardHeader>

									<CardContent className="flex-1">
										<p className="text-sm text-muted-foreground">
											{email.description}
										</p>
									</CardContent>

									<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-linear-to-r from-primary/50 to-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />
								</div>
							</Card>
						</Link>
					))}
				</div>
				{selectedEmail && (
					<EmailSheet
						renderedContent={
							await render(
								// @ts-expect-error This is not really important to type.
								<selectedEmail.preview {...selectedEmail.sampleData} />,
							)
						}
					/>
				)}
			</div>
		</div>
	);
}
