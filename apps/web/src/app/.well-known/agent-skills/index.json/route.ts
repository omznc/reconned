import { AGENT_SKILLS, getSkillUrls, skillDigest } from "@/lib/agent-skills";

export function GET() {
	const urls = getSkillUrls();

	// Agent Skills Discovery RFC v0.2.0.
	const body = {
		$schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
		skills: AGENT_SKILLS.map((skill) => ({
			name: skill.name,
			type: "skill-md",
			description: skill.description,
			url: `${urls.webUrl}/.well-known/agent-skills/${skill.name}/SKILL.md`,
			// Digest of the exact bytes the SKILL.md route serves — both are built
			// from the same generator, so this cannot drift.
			digest: skillDigest(skill.body(urls)),
		})),
	};

	return new Response(JSON.stringify(body), {
		headers: {
			"cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
			"content-type": "application/json; charset=utf-8",
		},
	});
}
