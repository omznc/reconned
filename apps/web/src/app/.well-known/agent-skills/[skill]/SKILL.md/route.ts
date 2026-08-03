import { AGENT_SKILLS, findAgentSkill, getSkillUrls } from "@/lib/agent-skills";

export function generateStaticParams() {
	return AGENT_SKILLS.map((skill) => ({ skill: skill.name }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ skill: string }> }) {
	const { skill: name } = await params;
	const skill = findAgentSkill(name);

	if (!skill) {
		return new Response("Not Found", {
			status: 404,
			headers: { "content-type": "text/plain; charset=utf-8" },
		});
	}

	return new Response(skill.body(getSkillUrls()), {
		headers: {
			"cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
			"content-type": "text/markdown; charset=utf-8",
		},
	});
}
