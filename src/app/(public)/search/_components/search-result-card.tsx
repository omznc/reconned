import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface SearchResultCardProps {
    title: string;
    description?: string | null;
    href: string;
    badges?: string[];
    meta?: string;
}

export function SearchResultCard({ title, description, href, badges, meta }: SearchResultCardProps) {
    return (
        <Card className="bg-sidebar">
            <CardHeader>
                <CardTitle className="text-lg font-semibold">{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
                {badges && (
                    <div className="flex gap-2 flex-wrap mt-2">
                        {badges.map((badge) => (
                            <Badge key={badge} variant="secondary">
                                {badge}
                            </Badge>
                        ))}
                    </div>
                )}
            </CardHeader>
            <CardFooter className="flex justify-between items-center">
                {meta && <span className="text-sm text-muted-foreground">{meta}</span>}
                <Button asChild>
                    <Link href={href}>Pogledaj</Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
