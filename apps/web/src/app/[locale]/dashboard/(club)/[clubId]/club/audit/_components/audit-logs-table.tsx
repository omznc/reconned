"use client";

import { Code, MoreHorizontal } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
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
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AuditLogsResponse = ApiResponse<"/api/clubs/{id}/audit-logs", "get">;

interface AuditLogsTableProps {
	logs: AuditLogsResponse["logs"];
	totalLogs: AuditLogsResponse["pagination"]["total"];
	pageSize: AuditLogsResponse["pagination"]["perPage"];
}

export function AuditLogsTable({ logs, totalLogs, pageSize }: AuditLogsTableProps) {
	const t = useExtracted();
	const locale = useLocale();
	const [selectedLog, setSelectedLog] = useState<AuditLogsResponse["logs"][number] | null>(null);

	const actionTypeMap: Record<string, string> = {
		CLUB_CREATE: t("Club creation"),
		CLUB_UPDATE: t("Club update"),
		CLUB_DELETE: t("Club deletion"),
		MEMBER_INVITE: t("Member invite"),
		MEMBER_JOINED_VIA_INVITE: t("Member joined via invite"),
		MEMBER_ADD: t("Member added"),
		MEMBER_REMOVE: t("Member removal"),
		MEMBER_PROMOTE: t("Member promotion"),
		MEMBER_DEMOTE: t("Member demotion"),
		MEMBER_JOIN: t("Member join"),
		MEMBER_LEAVE: t("Member leave"),
		CLUB_BAN: t("Club ban"), // Admin-only
		CLUB_UNBAN: t("Club unban"),
		CLUB_OWNER_ASSIGNED: t("Club owner assigned"),
		SPENDING_CREATE: t("Spending creation"),
		SPENDING_UPDATE: t("Spending update"),
		SPENDING_DELETE: t("Spending deletion"),
		POST_CREATE: t("Post creation"),
		POST_UPDATE: t("Post update"),
		POST_DELETE: t("Post deletion"),
		INSTAGRAM_CONNECT: t("Instagram connection"),
		INSTAGRAM_DISCONNECT: t("Instagram disconnection"),
		EVENT_CREATE: t("Event creation"),
		EVENT_UPDATE: t("Event update"),
		EVENT_DELETE: t("Event deletion"),
		CLUB_RULE_UPDATE: t("Club rule update"),
		CLUB_RULE_CREATE: t("Club rule creation"),
		CLUB_RULE_DELETE: t("Club rule deletion"),
		MEMBERSHIP_EXTENSION: t("Membership extension"),
	};

	const getActionTypeLabel = (actionType: string): string => {
		return actionTypeMap[actionType] || actionType;
	};

	// Create filter options from the action type map
	const filterOptions = [
		{ label: t("All actions"), value: "all" },
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
				searchPlaceholder={t("Search audit logs...")}
				columns={[
					{
						key: "createdAt",
						header: t("Date"),
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
						header: t("Action"),
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
						header: t("User"),
						sortable: true,
					},
					{
						key: "ipAddress",
						header: t("IP address"),
						sortable: true,
						cellConfig: {
							variant: "custom",
							component: (value) => value || "—",
						},
					},
					{
						key: "actions",
						header: t("Actions"),
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
											{t("View details")}
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
						label: t("Filter by action"),
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
	log: AuditLogsResponse["logs"][number] | null;
	onClose: () => void;
}

function LogDetailCredenza({ actionTypeMap, log, onClose }: LogDetailCredenzaProps) {
	const t = useExtracted();
	const locale = useLocale();

	if (!log) {
		return null;
	}

	return (
		<Credenza open={Boolean(log)} onOpenChange={onClose}>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle className="truncate mr-8">{t("Log details")}</CredenzaTitle>
					<CredenzaDescription>
						{new Date(log.createdAt).toLocaleDateString(locale, {
							year: "numeric",
							month: "long",
							day: "2-digit",
						})}{" "}
						• {log.user?.name || "-"}
					</CredenzaDescription>
				</CredenzaHeader>

				<div className="mt-4 space-y-4 p-4 md:p-0">
					<div>
						<h3 className="text-sm font-medium">{t("Action type")}</h3>
						<p className="mt-1 font-mono text-sm">{actionTypeMap[log.actionType] || log.actionType}</p>
					</div>

					<div>
						<h3 className="text-sm font-medium">{t("User")}</h3>
						<p className="mt-1 text-sm">
							{log.user?.name || "-"} ({log.user?.email || "-"})
						</p>
					</div>

					{log.ipAddress && (
						<div>
							<h3 className="text-sm font-medium">{t("IP address")}</h3>
							<p className="mt-1 font-mono text-sm">{log.ipAddress}</p>
						</div>
					)}

					{log.userAgent && (
						<div>
							<h3 className="text-sm font-medium">{t("User agent")}</h3>
							<p className="mt-1 text-sm truncate">{log.userAgent}</p>
						</div>
					)}

					<div>
						<h3 className="text-sm font-medium">{t("Action data")}</h3>
						<pre className="mt-1 p-4 bg-muted rounded-md overflow-auto text-xs max-h-[300px]">
							{JSON.stringify(log.actionData, null, 2)}
						</pre>
					</div>
				</div>
			</CredenzaContent>
		</Credenza>
	);
}
