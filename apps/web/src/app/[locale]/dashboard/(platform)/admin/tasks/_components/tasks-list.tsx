"use client";

import { Play } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GenericDataTable } from "@/components/generic-data-table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type Task = ApiResponse<"/api/admin/tasks", "get">["tasks"][number];

export function TasksList() {
	const t = useExtracted();
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState<Record<string, boolean>>({});
	const [isInitialLoading, setIsInitialLoading] = useState(true);

	useEffect(() => {
		const fetchTasks = async () => {
			try {
				const { data, error } = await apiClient.GET("/api/admin/tasks");
				if (error) {
					toast.error(t("Failed to load tasks"));
					return;
				}
				if (data?.tasks) {
					setTasks(data.tasks);
				}
			} catch {
				toast.error(t("Failed to load tasks"));
			} finally {
				setIsInitialLoading(false);
			}
		};
		fetchTasks();
	}, [t]);

	const handleRunTask = async (taskName: string) => {
		setLoading((prev) => ({ ...prev, [taskName]: true }));
		try {
			const { data, error } = await apiClient.POST("/api/admin/tasks/{taskName}/run", {
				params: {
					path: { taskName },
				},
			});

			if (error) {
				toast.error(t("Failed to run task"));
				return;
			}

			if (data?.success) {
				toast.success(data.message || t("Task completed successfully"), {
					description: data.duration ? `Duration: ${data.duration}` : undefined,
				});
			}
		} catch {
			toast.error(t("Failed to run task"));
		} finally {
			setLoading((prev) => ({ ...prev, [taskName]: false }));
		}
	};

	if (isInitialLoading) {
		return (
			<div className="space-y-2">
				{[1, 2, 3].map((i) => (
					<div key={i} className="h-16 w-full animate-pulse bg-muted rounded-md border" />
				))}
			</div>
		);
	}

	if (tasks.length === 0) {
		return (
			<div className="rounded-md border p-8">
				<p className="text-sm text-muted-foreground text-center">{t("No tasks available")}</p>
			</div>
		);
	}

	return (
		<GenericDataTable
			data={tasks}
			totalPages={1}
			searchPlaceholder={t("Search tasks...")}
			columns={[
				{
					key: "name",
					header: t("Task Name"),
					cellConfig: {
						variant: "custom",
						component: (_, task) => (
							<div className="flex items-center gap-2">
								<span className="font-medium font-mono text-sm">{task.name}</span>
							</div>
						),
					},
				},
				{
					key: "description",
					header: t("Description"),
					cellConfig: {
						variant: "custom",
						component: (_, task) => (
							<span className="text-sm text-muted-foreground">{task.description}</span>
						),
					},
				},
				{
					key: "interval",
					header: t("Schedule"),
					cellConfig: {
						variant: "custom",
						component: (_, task) => <Badge variant="outline">{task.interval}</Badge>,
					},
				},
				{
					key: "actions",
					header: t("Actions"),
					cellConfig: {
						variant: "custom",
						components: (task) => [
							<DropdownMenuItem
								key="run"
								disabled={loading[task.name]}
								onSelect={(e) => {
									e.preventDefault();
									handleRunTask(task.name);
								}}
							>
								<Play className="size-4 mr-2" />
								{loading[task.name] ? t("Running...") : t("Run now")}
							</DropdownMenuItem>,
						],
					},
				},
			]}
		/>
	);
}
