"use client";

import { Maximize2 } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useCallback, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type ChartData = {
	title: string;
	// biome-ignore lint/suspicious/noExplicitAny: Dynamic chart that I don't want to type
	data: any[];
	// biome-ignore lint/suspicious/noExplicitAny: same
	renderChart: (data: any[]) => ReactNode;
};

type StatsChartsProps = {
	memberData: Array<{ date: string; members: number }>;
	roleData: Array<{ role: string; count: number }>;
	eventData: Array<{ month: string; count: number }>;
	registrationData: Array<{ name: string; registrations: number }>;
};

export function StatsCharts({ memberData, roleData, eventData, registrationData }: StatsChartsProps) {
	const [fullscreenChart, setFullscreenChart] = useState<ChartData | null>(null);
	const t = useExtracted();

	const chartConfig = {
		members: {
			label: t("Number of members"),
			theme: {
				light: "hsl(221.2 83.2% 53.3%)",
				dark: "hsl(217.2 91.2% 59.8%)",
			},
		},
		registrations: {
			label: t("Number of applications"),
			theme: {
				light: "hsl(262.1 83.3% 57.8%)",
				dark: "hsl(263.4 70% 50.4%)",
			},
		},
		roles: {
			label: t("Roles"),
			theme: {
				light: "hsl(142.1 76.2% 36.3%)",
				dark: "hsl(143.8 61.2% 40.2%)",
			},
		},
		events: {
			label: t("Events by month"),
			theme: {
				light: "hsl(346.8 77.2% 49.8%)",
				dark: "hsl(346.8 77.2% 49.8%)",
			},
		},
	} satisfies ChartConfig;

	// biome-ignore lint/suspicious/noExplicitAny: Idc
	const CustomTooltip = useCallback((props: any) => {
		return <ChartTooltipContent {...props} />;
	}, []);

	const charts: ChartData[] = [
		{
			title: t("Membership growth"),
			data: memberData,
			renderChart: (data) => (
				<AreaChart data={data} accessibilityLayer>
					<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
					<XAxis dataKey="date" className="text-xs" />
					<YAxis className="text-xs" />
					<Area
						dataKey="members"
						name={t("Number of members")}
						fill="var(--color-members)"
						stroke="var(--color-members)"
						fillOpacity={0.2}
						radius={4}
					/>
					<ChartTooltip content={CustomTooltip} />
				</AreaChart>
			),
		},
		{
			title: t("Role distribution"),
			data: roleData,
			renderChart: (data) => (
				<BarChart data={data} accessibilityLayer>
					<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
					<XAxis
						dataKey="role"
						className="text-xs"
						tickFormatter={(value) => {
							const roles = {
								user: t("Member"),
								manager: t("Manager"),
								club_owner: t("The owner"),
							};
							return roles[value as keyof typeof roles] || value;
						}}
					/>
					<YAxis className="text-xs" />
					<Bar dataKey="count" name={t("Number of members")} fill="var(--color-roles)" radius={4} />
					<ChartTooltip content={CustomTooltip} />
				</BarChart>
			),
		},
		{
			title: t("Events by month"),
			data: eventData,
			renderChart: (data) => (
				<BarChart data={data} accessibilityLayer>
					<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
					<XAxis dataKey="month" className="text-xs" />
					<YAxis className="text-xs" />
					<Bar dataKey="count" name={t("Number of events")} fill="var(--color-events)" radius={4} />
					<ChartTooltip content={CustomTooltip} />
				</BarChart>
			),
		},
		{
			title: t("Number of applications"),
			data: registrationData,
			renderChart: (data) => (
				<BarChart data={data} accessibilityLayer>
					<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
					<XAxis dataKey="name" className="text-xs" />
					<YAxis className="text-xs" />
					<Bar
						dataKey="registrations"
						name={t("Number of applications")}
						fill="var(--color-registrations)"
						radius={4}
					/>
					<ChartTooltip content={CustomTooltip} />
				</BarChart>
			),
		},
	];

	// TODO: Fix mobile

	return (
		<>
			<div className="grid gap-4 grid-cols-2">
				{charts.map((chart, index) => (
					<ChartContainer key={index} config={chartConfig} className="p-4 min-h-[300px] w-full relative">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-semibold">{chart.title}</h3>
							<Button variant="ghost" size="icon" onClick={() => setFullscreenChart(chart)}>
								<Maximize2 className="h-4 w-4" />
							</Button>
						</div>
						{chart.renderChart(chart.data)}
					</ChartContainer>
				))}
			</div>

			<Dialog open={!!fullscreenChart} onOpenChange={() => setFullscreenChart(null)}>
				<DialogContent className="max-w-(--breakpoint-xl) w-[90vw] h-[90vh]">
					{fullscreenChart && (
						<>
							<DialogTitle>{fullscreenChart.title}</DialogTitle>
							<ChartContainer config={chartConfig} className="p-4 w-full h-full">
								{fullscreenChart.renderChart(fullscreenChart.data)}
							</ChartContainer>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
