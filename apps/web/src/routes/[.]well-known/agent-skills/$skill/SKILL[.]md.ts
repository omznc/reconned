import { createFileRoute } from "@tanstack/react-router";
import { findAgentSkill, getSkillUrls } from "@/lib/agent-skills";

export const Route = createFileRoute("/.well-known/agent-skills/$skill/SKILL.md")({
	server: {
		handlers: {
			GET: ({ params }) => {
				const skill = findAgentSkill(params.skill);

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
			},
		},
	},
});
