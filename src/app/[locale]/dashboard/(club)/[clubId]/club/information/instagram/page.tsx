"use client";

import { SiFacebook, SiInstagram } from "@icons-pack/react-simple-icons";
import { AlertCircle, ArrowLeft, Info, Loader, ShieldAlert, Verified } from "lucide-react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter } from "@/i18n/navigation";

interface FacebookPage {
	id: string;
	name: string;
	access_token: string;
	tasks?: string[];
	category?: string;
	category_list?: Array<{ id: string; name: string }>;
	picture?: { data: { url: string } };
	instagram_business_account?: {
		id: string;
		username?: string;
		profile_picture_url?: string;
	};
	has_instagram_business_account?: boolean;
}

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
	const t = useTranslations();

	// Fetch the available Facebook pages
	useEffect(() => {
		if (!sessionId) {
			setError(t("dashboard.club.info.instagramSessionMissing"));
			setIsLoading(false);
			return;
		}

		const fetchPages = async () => {
			try {
				const response = await fetch(
					`/api/club/instagram/page-selection?sessionId=${sessionId}&clubId=${params.clubId}`,
				);

				if (!response.ok) {
					const errorData = await response.json();
					setError(errorData.error || t("dashboard.club.info.instagramPagesFetchFailed"));
					setIsLoading(false);
					return;
				}

				const data = await response.json();

				// Check eligibility of pages by detecting which ones have Instagram business accounts
				const pagesWithEligibilityInfo = data.pages.map((page: FacebookPage) => {
					const hasInstagramAccount = !!page.instagram_business_account;
					return {
						...page,
						has_instagram_business_account: hasInstagramAccount,
					};
				});

				const eligiblePageIds = pagesWithEligibilityInfo
					.filter((page: FacebookPage) => page.has_instagram_business_account)
					.map((page: FacebookPage) => page.id);

				setPages(pagesWithEligibilityInfo);
				setEligiblePages(eligiblePageIds);

				// If there are eligible pages, auto-select the first one
				if (eligiblePageIds.length > 0 && !selectedPageId) {
					setSelectedPageId(eligiblePageIds[0]);
				}

				setIsLoading(false);
			} catch (err) {
				setError(t("dashboard.club.info.instagramPagesFetchFailed"));
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
				throw new Error(t("dashboard.club.info.instagramSelectedPageNotFound"));
			}

			// Redirect to the callback route with the selected page ID and its page-specific access token
			window.location.href = `/api/club/instagram/callback?pageId=${selectedPageId}&accessToken=${encodeURIComponent(selectedPage.access_token)}&state=${params.clubId}`;
		} catch (err) {
			setError(err instanceof Error ? err.message : t("dashboard.club.info.instagramConnectionFailed"));
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
				<Loader className="h-8 w-8 animate-spin text-primary mb-4" />
				<p className="text-lg text-muted-foreground">{t("dashboard.club.info.instagramLoadingPages")}</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[60vh]">
				<AlertCircle className="h-12 w-12 text-destructive" />
				<h2 className="text-xl font-bold mt-4">{t("dashboard.club.info.instagramError")}</h2>
				<p className="text-muted-foreground mt-2">{error}</p>
				<Button variant="default" className="mt-6" onClick={handleCancel}>
					<ArrowLeft className="mr-2 h-4 w-4" />
					{t("dashboard.club.info.backToClub")}
				</Button>
			</div>
		);
	}

	if (pages.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{t("dashboard.club.info.instagramNoPages")}</CardTitle>
					<CardDescription>{t("dashboard.club.info.instagramNoPageDescription")}</CardDescription>
				</CardHeader>
				<CardContent>
					<Button onClick={handleCancel}>{t("dashboard.club.info.backToClub")}</Button>
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
					<SiInstagram className="h-5 w-5" />
					<CardTitle>{t("dashboard.club.info.instagramSelectPageTitle")}</CardTitle>
				</div>
				<CardDescription>{t("dashboard.club.info.instagramSelectPageDescription")}</CardDescription>
			</CardHeader>

			{!hasEligiblePages && (
				<CardContent>
					<Alert className="mb-4">
						<ShieldAlert className="h-4 w-4" />
						<AlertDescription>{t("dashboard.club.info.instagramNoEligiblePages")}</AlertDescription>
					</Alert>
				</CardContent>
			)}

			<CardContent>
				<div className="space-y-4">
					{pages.map((page) => {
						const isEligible = page.has_instagram_business_account;

						return (
							<div
								key={page.id}
								className={`border rounded-md p-4 flex items-center gap-4 transition-colors ${
									isEligible ? "hover:bg-accent/50 cursor-pointer" : "opacity-75 bg-muted"
								} ${selectedPageId === page.id ? "border-primary bg-accent" : ""}`}
								onClick={() => isEligible && handleSelectPage(page.id)}
							>
								<div className="flex items-center gap-3 flex-1">
									{page.picture?.data?.url ? (
										<div className="h-12 w-12 flex-shrink-0 relative overflow-hidden rounded-md">
											<Image
												src={page.picture.data.url}
												alt={page.name}
												fill
												className="object-cover"
											/>
										</div>
									) : (
										<div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
											<SiFacebook className="h-6 w-6 text-muted-foreground" />
										</div>
									)}
									<div className="flex-1">
										<div className="font-medium">{page.name}</div>
										<div className="text-sm text-muted-foreground">
											{page.category || page.category_list?.[0]?.name || "Facebook Page"}
										</div>
									</div>

									{isEligible ? (
										<div className="flex flex-shrink-0 items-center text-sm text-green-600 font-medium gap-1">
											<Verified className="h-4 w-4" />
											<span>{t("dashboard.club.info.instagramEligible")}</span>
										</div>
									) : (
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<div className="flex flex-shrink-0 items-center text-sm text-amber-500 font-medium gap-1">
														<Info className="h-4 w-4" />
														<span>{t("dashboard.club.info.instagramIneligible")}</span>
													</div>
												</TooltipTrigger>
												<TooltipContent className="max-w-xs">
													<p>{t("dashboard.club.info.instagramIneligibleTooltip")}</p>
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
					{t("dashboard.club.info.cancel")}
				</Button>
				<Button
					onClick={handleConnect}
					disabled={!selectedPageId || isConnecting || !hasEligiblePages}
					className="gap-2"
				>
					{isConnecting ? (
						<>
							<Loader className="h-4 w-4 animate-spin" />
							<span>{t("dashboard.club.info.instagramConnecting")}</span>
						</>
					) : (
						<>
							<SiInstagram className="h-4 w-4" />
							<span>{t("dashboard.club.info.instagramConnect")}</span>
						</>
					)}
				</Button>
			</CardFooter>
		</Card>
	);
}
