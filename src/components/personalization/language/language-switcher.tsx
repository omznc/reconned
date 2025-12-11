"use client";
import { Globe } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LANGUAGE_TRANSLATIONS, VALID_LOCALES } from "@/i18n/valid-locales";
import { cn } from "@/lib/utils";

export interface LanguageSwitcherProps extends ButtonProps {}
export function LanguageSwitcher({ className, variant, ...props }: LanguageSwitcherProps) {
	const t = useExtracted();
	const router = useRouter();
	const path = usePathname();
	const locale = useLocale();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant={variant || "ghost"}
					suppressHydrationWarning
					className={cn("items-center w-full justify-start cursor-pointer shadow-none", className)}
					{...props}
				>
					<Globe className="h-[1.2rem] w-[1.2rem] rotate-0 ml-2 scale-100 transition-all" />
					{LANGUAGE_TRANSLATIONS[locale as keyof typeof LANGUAGE_TRANSLATIONS]}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuLabel>{t("Choose a language")}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{VALID_LOCALES.map((localeOption) => (
					<DropdownMenuItem
						key={localeOption}
						onClick={async () => {
							if (localeOption !== locale) {
								router.push(path, { locale: localeOption });
								router.refresh();
							}
						}}
						className={cn(locale === localeOption && "bg-accent")}
					>
						<div className="flex items-center gap-2">
							<span>{LANGUAGE_TRANSLATIONS[localeOption]}</span>
							{localeOption === "en" && (
								<span className="text-xs text-muted-foreground">In progress</span>
							)}
						</div>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
