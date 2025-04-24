"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Credenza,
	CredenzaContent,
	CredenzaHeader,
	CredenzaTitle,
	CredenzaDescription,
} from "@/components/ui/credenza";
import { useState } from "react";
import { Code } from "lucide-react";
import type { JsonValue } from "@prisma/client/runtime/client";

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
	const t = useTranslations("dashboard.club.audit");
	const locale = useLocale();
	const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

	const actionTypeMap: Record<string, string> = {
		CLUB_CREATE: t("actionTypes.clubCreate"),
		CLUB_UPDATE: t("actionTypes.clubUpdate"),
		CLUB_DELETE: t("actionTypes.clubDelete"),
		MEMBER_INVITE: t("actionTypes.memberInvite"),
		MEMBER_REMOVE: t("actionTypes.memberRemove"),
		MEMBER_PROMOTE: t("actionTypes.memberPromote"),
		MEMBER_DEMOTE: t("actionTypes.memberDemote"),
		MEMBER_JOIN: t("actionTypes.memberJoin"),
		MEMBER_LEAVE: t("actionTypes.memberLeave"),
		CLUB_BAN: t("actionTypes.clubBan"), // Admin-only
		CLUB_UNBAN: t("actionTypes.clubUnban"),
		SPENDING_CREATE: t("actionTypes.spendingCreate"),
		SPENDING_UPDATE: t("actionTypes.spendingUpdate"),
		SPENDING_DELETE: t("actionTypes.spendingDelete"),
		POST_CREATE: t("actionTypes.postCreate"),
		POST_UPDATE: t("actionTypes.postUpdate"),
		POST_DELETE: t("actionTypes.postDelete"),
		INSTAGRAM_CONNECT: t("actionTypes.instagramConnect"),
		INSTAGRAM_DISCONNECT: t("actionTypes.instagramDisconnect"),
		EVENT_CREATE: t("actionTypes.eventCreate"),
		EVENT_UPDATE: t("actionTypes.eventUpdate"),
		EVENT_DELETE: t("actionTypes.eventDelete"),
		CLUB_RULE_UPDATE: t("actionTypes.clubRuleUpdate"),
		CLUB_RULE_CREATE: t("actionTypes.clubRuleCreate"),
		CLUB_RULE_DELETE: t("actionTypes.clubRuleDelete"),
		MEMBERSHIP_EXTENSION: t("actionTypes.membershipExtension"),
	};

	const getActionTypeLabel = (actionType: string): string => {
		return actionTypeMap[actionType] || actionType;
	};

	// Create filter options from the action type map
	const filterOptions = [
		{ label: t("allActions"), value: "all" },
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
				searchPlaceholder={t("search")}
				columns={[
					{
						key: "createdAt",
						header: t("columns.date"),
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
						header: t("columns.action"),
						sortable: true,
						cellConfig: {
							variant: "custom",
							component: (value, row) => (
								<Badge variant="secondary" className="font-mono">
									{getActionTypeLabel(value)}
								</Badge>
							),
						},
					},
					{
						key: "user.name",
						header: t("columns.user"),
						sortable: true,
					},
					{
						key: "ipAddress",
						header: t("columns.ipAddress"),
						sortable: true,
						cellConfig: {
							variant: "custom",
							component: (value) => value || "—",
						},
					},
					{
						key: "actions",
						header: t("columns.actions"),
						cellConfig: {
							variant: "custom",
							component: (_, log) => (
								<Button size="sm" variant="outline" onClick={() => setSelectedLog(log)}>
									<Code className="h-4 w-4 mr-1" />
									{t("viewDetails")}
								</Button>
							),
						},
					},
				]}
				filters={[
					{
						key: "actionType",
						label: t("filterByAction"),
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
	const t = useTranslations("dashboard.club.audit");
	const locale = useLocale();

	if (!log) {
		return null;
	}

	return (
		<Credenza open={Boolean(log)} onOpenChange={onClose}>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle className="truncate mr-8">{t("detailsTitle")}</CredenzaTitle>
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
						<h3 className="text-sm font-medium">{t("actionType")}</h3>
						<p className="mt-1 font-mono text-sm">{actionTypeMap[log.actionType] || log.actionType}</p>
					</div>

					<div>
						<h3 className="text-sm font-medium">{t("userInfo")}</h3>
						<p className="mt-1 text-sm">
							{log.user?.name ?? "-"} ({log.user?.email ?? "-"})
						</p>
					</div>

					{log.ipAddress && (
						<div>
							<h3 className="text-sm font-medium">{t("ipAddress")}</h3>
							<p className="mt-1 font-mono text-sm">{log.ipAddress}</p>
						</div>
					)}

					{log.userAgent && (
						<div>
							<h3 className="text-sm font-medium">{t("userAgent")}</h3>
							<p className="mt-1 text-sm truncate">{log.userAgent}</p>
						</div>
					)}

					<div>
						<h3 className="text-sm font-medium">{t("actionData")}</h3>
						<pre className="mt-1 p-4 bg-muted rounded-md overflow-auto text-xs max-h-[300px]">
							{JSON.stringify(log.actionData, null, 2)}
						</pre>
					</div>
				</div>
			</CredenzaContent>
		</Credenza>
	);
}
