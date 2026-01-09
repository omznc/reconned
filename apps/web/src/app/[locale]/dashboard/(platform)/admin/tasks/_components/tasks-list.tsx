"use client";

import { PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
			<div className="grid gap-4">
				{[1, 2, 3].map((i) => (
					<Card key={i}>
						<CardHeader>
							<div className="h-6 w-48 animate-pulse bg-muted rounded" />
							<div className="h-4 w-full animate-pulse bg-muted rounded" />
						</CardHeader>
					</Card>
				))}
			</div>
		);
	}

	if (tasks.length === 0) {
		return (
			<Card>
				<CardContent className="pt-6">
					<p className="text-sm text-muted-foreground text-center">{t("No tasks available")}</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="grid gap-4">
			{tasks.map((task) => (
				<Card key={task.name}>
					<CardHeader>
						<div className="flex items-start justify-between">
							<div className="space-y-1">
								<CardTitle className="text-base">{task.name}</CardTitle>
								<CardDescription>{task.description}</CardDescription>
								<p className="text-xs text-muted-foreground">
									{t("Runs every")} {task.interval}
								</p>
							</div>
							<Button
								size="sm"
								variant="outline"
								onClick={() => handleRunTask(task.name)}
								disabled={loading[task.name]}
							>
								<PlayIcon className="h-4 w-4 mr-2" />
								{loading[task.name] ? t("Running...") : t("Run now")}
							</Button>
						</div>
					</CardHeader>
				</Card>
			))}
		</div>
	);
}
