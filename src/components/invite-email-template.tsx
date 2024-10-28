export interface InviteEmailTemplateProps {
	name: string;
	email: string;
	inviteLink: string;
}

export function InviteEmailTemplate({
	name,
	email,
	inviteLink,
}: InviteEmailTemplateProps) {
	return (
		<div className="max-w-md mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
			<div className="px-6 py-4">
				<h1 className="text-2xl font-bold text-gray-800 mb-4">
					Verifikujte vašu email adresu
				</h1>
				<p className="text-gray-600 mb-4">Pozdrav {name},</p>
				<p className="text-gray-600 mb-6">
					Pozvani ste da se pridružite našoj platformi. Radujemo se što ćete nam
					se pridružiti!
				</p>
				<a
					href={inviteLink}
					className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded text-center transition duration-300 mb-6"
					aria-label="Accept invitation"
				>
					Prihvatite poziv
				</a>
				<p className="text-sm text-gray-500 mb-2">
					Ako dugme iznad ne radi, molimo kopirajte i zalijepite sljedeći link u
					vaš pretraživač:
				</p>
				<a
					href={inviteLink}
					className="text-blue-500 hover:underline break-all"
				>
					{inviteLink}
				</a>
				<hr className="my-6 border-gray-200" />
				<p className="text-xs text-gray-400">
					Ova pozivnica je poslana na {email}. Ako niste očekivali ovu
					pozivnicu, možete je ignorisati. Ako ste zabrinuti za sigurnost vašeg
					računa, molimo kontaktirajte nas.
				</p>
			</div>
		</div>
	);
}
