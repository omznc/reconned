"use client";

import type { JsonValue } from "@prisma/client/runtime/client";
import { Code, MoreHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { GenericDataTable } from "@/components/generic-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Credenza,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AuditLog = {
	id: string;
	createdAt: Date;
	actionType: string;
	actionData: JsonValue;
	user: {
		id: string;
		name: string;
		email: string;
	} | null;
	ipAddress: string | null;
	userAgent: string | null;
};

interface AuditLogsTableProps {
	logs: AuditLog[];
	totalLogs: number;
	pageSize: number;
}

export function AuditLogsTable({ logs, totalLogs, pageSize }: AuditLogsTableProps) {
	const t = useTranslations();
	const locale = useLocale();
	const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

	const actionTypeMap: Record<string, string> = {
		CLUB_CREATE: t("dashboard.club.audit.actionTypes.clubCreate"),
		CLUB_UPDATE: t("dashboard.club.audit.actionTypes.clubUpdate"),
		CLUB_DELETE: t("dashboard.club.audit.actionTypes.clubDelete"),
		MEMBER_INVITE: t("dashboard.club.audit.actionTypes.memberInvite"),
		MEMBER_REMOVE: t("dashboard.club.audit.actionTypes.memberRemove"),
		MEMBER_PROMOTE: t("dashboard.club.audit.actionTypes.memberPromote"),
		MEMBER_DEMOTE: t("dashboard.club.audit.actionTypes.memberDemote"),
		MEMBER_JOIN: t("dashboard.club.audit.actionTypes.memberJoin"),
		MEMBER_LEAVE: t("dashboard.club.audit.actionTypes.memberLeave"),
		CLUB_BAN: t("dashboard.club.audit.actionTypes.clubBan"), // Admin-only
		CLUB_UNBAN: t("dashboard.club.audit.actionTypes.clubUnban"),
		SPENDING_CREATE: t("dashboard.club.audit.actionTypes.spendingCreate"),
		SPENDING_UPDATE: t("dashboard.club.audit.actionTypes.spendingUpdate"),
		SPENDING_DELETE: t("dashboard.club.audit.actionTypes.spendingDelete"),
		POST_CREATE: t("dashboard.club.audit.actionTypes.postCreate"),
		POST_UPDATE: t("dashboard.club.audit.actionTypes.postUpdate"),
		POST_DELETE: t("dashboard.club.audit.actionTypes.postDelete"),
		INSTAGRAM_CONNECT: t("dashboard.club.audit.actionTypes.instagramConnect"),
		INSTAGRAM_DISCONNECT: t("dashboard.club.audit.actionTypes.instagramDisconnect"),
		EVENT_CREATE: t("dashboard.club.audit.actionTypes.eventCreate"),
		EVENT_UPDATE: t("dashboard.club.audit.actionTypes.eventUpdate"),
		EVENT_DELETE: t("dashboard.club.audit.actionTypes.eventDelete"),
		CLUB_RULE_UPDATE: t("dashboard.club.audit.actionTypes.clubRuleUpdate"),
		CLUB_RULE_CREATE: t("dashboard.club.audit.actionTypes.clubRuleCreate"),
		CLUB_RULE_DELETE: t("dashboard.club.audit.actionTypes.clubRuleDelete"),
		MEMBERSHIP_EXTENSION: t("dashboard.club.audit.actionTypes.membershipExtension"),
	};

	const getActionTypeLabel = (actionType: string): string => {
		return actionTypeMap[actionType] || actionType;
	};

	// Create filter options from the action type map
	const filterOptions = [
		{ label: t("dashboard.club.audit.allActions"), value: "all" },
		// Generate options from the actionTypeMap
		...Object.entries(actionTypeMap).map(([value, label]) => ({
			label,
			value,
		})),
	];
	return (
		<>
			<GenericDataTable
				data={logs}
				totalPages={Math.ceil(totalLogs / pageSize)}
				searchPlaceholder={t("dashboard.club.audit.search")}
				columns={[
					{
						key: "createdAt",
						header: t("dashboard.club.audit.columns.date"),
						sortable: true,
						cellConfig: {
							variant: "custom",
							component: (value) =>
								new Date(value).toLocaleDateString(locale, {
									year: "numeric",
									month: "long",
									day: "2-digit",
								}),
						},
					},
					{
						key: "actionType",
						header: t("dashboard.club.audit.columns.action"),
						sortable: true,
						cellConfig: {
							variant: "custom",
							component: (value) => (
								<Badge variant="secondary" className="font-mono">
									{getActionTypeLabel(value)}
								</Badge>
							),
						},
					},
					{
						key: "user.name",
						header: t("dashboard.club.audit.columns.user"),
						sortable: true,
					},
					{
						key: "ipAddress",
						header: t("dashboard.club.audit.columns.ipAddress"),
						sortable: true,
						cellConfig: {
							variant: "custom",
							component: (value) => value || "—",
						},
					},
					{
						key: "actions",
						header: t("dashboard.club.audit.columns.actions"),
						cellConfig: {
							variant: "custom",
							component: (_, log) => (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="sm">
											<MoreHorizontal className="size-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => setSelectedLog(log)}>
											<Code className="size-4 mr-2" />
											{t("dashboard.club.audit.viewDetails")}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							),
						},
					},
				]}
				filters={[
					{
						key: "actionType",
						label: t("dashboard.club.audit.filterByAction"),
						options: filterOptions,
					},
				]}
			/>

			<LogDetailCredenza actionTypeMap={actionTypeMap} log={selectedLog} onClose={() => setSelectedLog(null)} />
		</>
	);
}

interface LogDetailCredenzaProps {
	actionTypeMap: Record<string, string>;
	log: AuditLog | null;
	onClose: () => void;
}

function LogDetailCredenza({ actionTypeMap, log, onClose }: LogDetailCredenzaProps) {
	const t = useTranslations();
	const locale = useLocale();

	if (!log) {
		return null;
	}

	return (
		<Credenza open={Boolean(log)} onOpenChange={onClose}>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle className="truncate mr-8">{t("dashboard.club.audit.detailsTitle")}</CredenzaTitle>
					<CredenzaDescription>
						{new Date(log.createdAt).toLocaleDateString(locale, {
							year: "numeric",
							month: "long",
							day: "2-digit",
						})}{" "}
						• {log.user?.name ?? "-"}
					</CredenzaDescription>
				</CredenzaHeader>

				<div className="mt-4 space-y-4 p-4 md:p-0">
					<div>
						<h3 className="text-sm font-medium">{t("dashboard.club.audit.actionType")}</h3>
						<p className="mt-1 font-mono text-sm">{actionTypeMap[log.actionType] || log.actionType}</p>
					</div>

					<div>
						<h3 className="text-sm font-medium">{t("dashboard.club.audit.userInfo")}</h3>
						<p className="mt-1 text-sm">
							{log.user?.name ?? "-"} ({log.user?.email ?? "-"})
						</p>
					</div>

					{log.ipAddress && (
						<div>
							<h3 className="text-sm font-medium">{t("dashboard.club.audit.ipAddress")}</h3>
							<p className="mt-1 font-mono text-sm">{log.ipAddress}</p>
						</div>
					)}

					{log.userAgent && (
						<div>
							<h3 className="text-sm font-medium">{t("dashboard.club.audit.userAgent")}</h3>
							<p className="mt-1 text-sm truncate">{log.userAgent}</p>
						</div>
					)}

					<div>
						<h3 className="text-sm font-medium">{t("dashboard.club.audit.actionData")}</h3>
						<pre className="mt-1 p-4 bg-muted rounded-md overflow-auto text-xs max-h-[300px]">
							{JSON.stringify(log.actionData, null, 2)}
						</pre>
					</div>
				</div>
			</CredenzaContent>
		</Credenza>
	);
}
