"use client";

import type { Badge, UserBadge } from "@generated/client";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { BadgeIcon } from "./badge-icon";

interface UserBadgesProps {
	badges: (UserBadge & { badge: Badge })[];
}

export function UserBadges({ badges }: UserBadgesProps) {
	const t = useTranslations();

	if (badges.length === 0) {
		return null;
	}

	// Separate event badges and achievement badges
	const eventBadges = badges.filter((ub) => ub.badge.type === "EVENT");
	const achievementBadges = badges.filter((ub) => ub.badge.type === "ACHIEVEMENT");

	return (
		<div className="space-y-4">
			{achievementBadges.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>{t("components.badges.achievementBadges.title")}</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap gap-3">
							{achievementBadges.map((userBadge) => {
								const badge = userBadge.badge;
								const translationKey = `components.badges.achievements.${badge.slug}`;

								return (
									<HoverCard key={userBadge.id}>
										<HoverCardTrigger>
											<BadgeIcon icon={badge.icon} tier={badge.tier} size="md" />
										</HoverCardTrigger>
										<HoverCardContent>
											<div className="space-y-2">
												<h4 className="text-sm font-semibold">{t(`${translationKey}.name`)}</h4>
												<p className="text-xs text-muted-foreground">
													{t(`${translationKey}.description`)}
												</p>
												{badge.tier && (
													<p className="text-xs text-muted-foreground">
														{t("components.badges.tier")}: {badge.tier}
													</p>
												)}
											</div>
										</HoverCardContent>
									</HoverCard>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}

			{eventBadges.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>{t("components.badges.eventBadges.title")}</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap gap-3">
							{eventBadges.map((userBadge) => {
								const badge = userBadge.badge;

								return (
									<HoverCard key={userBadge.id}>
										<HoverCardTrigger>
											<BadgeIcon customImage={badge.customImage} size="md" />
										</HoverCardTrigger>
										<HoverCardContent>
											<div className="space-y-2">
												<h4 className="text-sm font-semibold">{badge.name}</h4>
												{badge.description && (
													<p className="text-xs text-muted-foreground">{badge.description}</p>
												)}
											</div>
										</HoverCardContent>
									</HoverCard>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
