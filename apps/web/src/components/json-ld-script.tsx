import type { JSX } from "react";
import type { Graph } from "schema-dts";

type JsonLdScriptProps = {
	data: Graph | unknown;
};

export default function JsonLdScript({ data }: JsonLdScriptProps): JSX.Element {
	// biome-ignore lint/security/noDangerouslySetInnerHtml: Scripts to these are being passed in from the server
	return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
