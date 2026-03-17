"use client";

import { AlertCircle, ArrowLeft, Facebook, Info, Instagram, InstagramIcon, ShieldAlert, Verified } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { Loader } from "@/components/loader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import { cn } from "@/lib/utils";

type FacebookPage = {
	id: string;
	name: string;
	access_token: string;
	instagram_business_account: {
		id: string;
		username?: string;
		profile_picture_url?: string;
	} | null;
};

export default function InstagramPageSelection() {
	const [pages, setPages] = useState<FacebookPage[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
	const [isConnecting, setIsConnecting] = useState(false);
	const [eligiblePages, setEligiblePages] = useState<string[]>([]);

	const params = useParams<{ clubId: string }>();
	const searchParams = useSearchParams();
	const sessionId = searchParams.get("sessionId");
	const router = useRouter();
	const t = useExtracted();

	// Fetch the available Facebook pages
	useEffect(() => {
		if (!sessionId) {
			setError(t("Missing session for page selection"));
			setIsLoading(false);
			return;
		}

		const fetchPages = async () => {
			try {
				const { data, error } = await apiClient.GET("/api/clubs/{id}/instagram/page-selection", {
					params: {
						path: { id: params.clubId },
						query: { sessionId },
					},
				});

				if (error || !data) {
					setError(error?.error || t("Failed to load Facebook pages"));
					setIsLoading(false);
					return;
				}

				// Check eligibility of pages by detecting which ones have Instagram business accounts
				const eligiblePageIds = data.pages
					.filter((page) => page.instagram_business_account !== null)
					.map((page) => page.id);

				setPages(data.pages);
				setEligiblePages(eligiblePageIds);

				// If there are eligible pages, auto-select the first one
				if (eligiblePageIds.length > 0 && !selectedPageId) {
					setSelectedPageId(eligiblePageIds[0] ?? null);
				}

				setIsLoading(false);
			} catch {
				setError(t("Failed to load Facebook pages"));
				setIsLoading(false);
			}
		};

		fetchPages();
	}, [sessionId, params.clubId, selectedPageId, t]);

	// Handle page selection
	const handleSelectPage = (pageId: string) => {
		setSelectedPageId(pageId);
	};

	// Complete the connection with selected page
	const handleConnect = () => {
		if (!selectedPageId) return;

		setIsConnecting(true);

		try {
			const selectedPage = pages.find((page) => page.id === selectedPageId);
			if (!selectedPage) {
				throw new Error(t("Selected page not found"));
			}

			// Redirect to the callback route with the selected page ID and its page-specific access token
			window.location.href = `/api/club/instagram/callback?pageId=${selectedPageId}&accessToken=${encodeURIComponent(selectedPage.access_token)}&state=${params.clubId}`;
		} catch (err) {
			setError(err instanceof Error ? err.message : t("Failed to connect Instagram account"));
			setIsConnecting(false);
		}
	};

	// Navigate back to club information page
	const handleCancel = () => {
		router.push(`/dashboard/${params.clubId}/club/information`);
	};

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[400px]">
				<div className="text-primary mb-4">
					<Loader size={32} />
				</div>
				<p className="text-lg text-muted-foreground">{t("Loading pages...")}</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh]">
				<AlertCircle className="h-12 w-12 text-destructive" />
				<h2 className="text-xl font-bold mt-4">{t("Problem connecting Instagram account")}</h2>
				<p className="text-muted-foreground mt-2">{error}</p>
				<Button variant="default" className="mt-6" onClick={handleCancel}>
					<ArrowLeft className="mr-2 h-4 w-4" />
					{t("Back to club")}
				</Button>
			</div>
		);
	}

	if (pages.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{t("No Facebook pages found")}</CardTitle>
					<CardDescription>
						{t(
							"No Facebook pages connected to your account found. First create a Facebook page and connect it to an Instagram Business account.",
						)}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button onClick={handleCancel}>{t("Back to club")}</Button>
				</CardContent>
			</Card>
		);
	}

	// Check if there are any eligible pages
	const hasEligiblePages = eligiblePages.length > 0;

	return (
		<Card className="max-w-3xl mx-auto">
			<CardHeader>
				<div className="flex items-center gap-2">
					<Instagram className="h-5 w-5" />
					<CardTitle>{t("Select Facebook Page")}</CardTitle>
				</div>
				<CardDescription>
					{t(
						"Select the Facebook page that is connected to the Instagram Business account you want to connect to your club.",
					)}
				</CardDescription>
			</CardHeader>

			{!hasEligiblePages && (
				<CardContent>
					<Alert className="mb-4">
						<ShieldAlert className="h-4 w-4" />
						<AlertDescription>
							{t(
								"None of your Facebook pages are connected to an Instagram Business account. First connect an Instagram Business account to your Facebook page.",
							)}
						</AlertDescription>
					</Alert>
				</CardContent>
			)}

			<CardContent>
				<div className="space-y-4">
					{pages.map((page) => {
						const isEligible = page.instagram_business_account !== null;

						return (
							// biome-ignore lint/a11y/useSemanticElements: Style stuff
							<div
								role="button"
								tabIndex={0}
								key={page.id}
								className={cn(
									"border rounded-md p-4 flex items-center gap-4 transition-colors",
									isEligible ? "hover:bg-accent/50 cursor-pointer" : "opacity-75 bg-muted",
									selectedPageId === page.id ? "border-primary bg-accent" : "",
								)}
								onClick={() => isEligible && handleSelectPage(page.id)}
							>
								<div className="flex items-center gap-3 flex-1">
									<div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
										<Facebook className="h-6 w-6 text-muted-foreground" />
									</div>
									<div className="flex-1">
										<div className="font-medium">{page.name}</div>
										<div className="text-sm text-muted-foreground">Facebook Page</div>
									</div>

									{isEligible ? (
										<div className="flex flex-shrink-0 items-center text-sm text-green-600 font-medium gap-1">
											<Verified className="h-4 w-4" />
											<span>{t("Available")}</span>
										</div>
									) : (
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<div className="flex flex-shrink-0 items-center text-sm text-amber-500 font-medium gap-1">
														<Info className="h-4 w-4" />
														<span>{t("Not available")}</span>
													</div>
												</TooltipTrigger>
												<TooltipContent className="max-w-xs">
													<p>
														{t(
															"This Facebook page is not connected to an Instagram Business account. To connect, first link an Instagram Business account to this Facebook page.",
														)}
													</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
			<CardFooter className="flex justify-between">
				<Button variant="outline" onClick={handleCancel} disabled={isConnecting}>
					{t("Cancel")}
				</Button>
				<Button
					onClick={handleConnect}
					disabled={!selectedPageId || isConnecting || !hasEligiblePages}
					className="gap-2"
				>
					{isConnecting ? (
						<>
							<Loader size={16} />
							<span>{t("Connecting...")}</span>
						</>
					) : (
						<>
							<InstagramIcon className="h-4 w-4" />
							<span>{t("Connect Instagram")}</span>
						</>
					)}
				</Button>
			</CardFooter>
		</Card>
	);
}
