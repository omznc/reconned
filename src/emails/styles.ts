export const emailStyles = {
	main: {
		backgroundColor: "#ffffff",
		fontFamily:
			'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
	},

	container: {
		margin: "0 auto",
		padding: "20px 0 48px",
	},

	logoSection: {
		textAlign: "center" as const,
		marginBottom: "20px",
	},

	logo: {
		margin: "0 auto",
	},

	h1: {
		color: "#000000",
		fontSize: "24px",
		fontWeight: "bold",
		textAlign: "center" as const,
		margin: "30px 0",
	},

	text: {
		color: "#000000",
		fontSize: "16px",
		lineHeight: "24px",
	},

	buttonContainer: {
		textAlign: "center" as const,
		margin: "30px 0",
	},

	button: {
		backgroundColor: "#000000",
		color: "#ffffff",
		fontSize: "16px",
		textDecoration: "none",
		textAlign: "center" as const,
		display: "inline-block",
		width: "200px",
		padding: "14px 0",
	},

	hr: {
		borderColor: "#000000",
		margin: "20px 0",
	},

	footer: {
		color: "#666666",
		fontSize: "12px",
		lineHeight: "16px",
		textAlign: "center" as const,
		marginTop: "30px",
	},

	smallText: {
		color: "#666666",
		fontSize: "14px",
		lineHeight: "20px",
		textAlign: "center" as const,
		margin: "10px 0",
	},

	clubName: {
		color: "#000000",
		fontSize: "24px",
		fontWeight: "bold",
		textAlign: "center" as const,
		margin: "20px 0 0",
	},

	code: {
		display: "block",
		width: "100%",
		padding: "16px 0",
		backgroundColor: "#ffffff",
		border: "1px solid #000000",
		color: "#000000",
		fontSize: "18px",
		textAlign: "center" as const,
		margin: "10px 0",
	},
} as const;
