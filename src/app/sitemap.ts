import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://reconned.com";

    // Static pages
    const staticPages = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: "daily" as const,
            priority: 1,
            alternates: {
                languages: Object.fromEntries(
                    routing.locales.map((locale) => [
                        locale,
                        locale === routing.defaultLocale ? baseUrl : `${baseUrl}/${locale}`,
                    ]),
                ),
            },
        },
        {
            url: `${baseUrl}/about`,
            lastModified: new Date(),
            changeFrequency: "monthly" as const,
            priority: 0.8,
            alternates: {
                languages: Object.fromEntries(
                    routing.locales.map((locale) => [
                        locale,
                        locale === routing.defaultLocale
                            ? `${baseUrl}/about`
                            : `${baseUrl}/${locale}/about`,
                    ]),
                ),
            },
        },
        {
            url: `${baseUrl}/clubs`,
            lastModified: new Date(),
            changeFrequency: "daily" as const,
            priority: 0.9,
            alternates: {
                languages: Object.fromEntries(
                    routing.locales.map((locale) => [
                        locale,
                        locale === routing.defaultLocale
                            ? `${baseUrl}/clubs`
                            : `${baseUrl}/${locale}/clubs`,
                    ]),
                ),
            },
        },
        {
            url: `${baseUrl}/events`,
            lastModified: new Date(),
            changeFrequency: "daily" as const,
            priority: 0.9,
            alternates: {
                languages: Object.fromEntries(
                    routing.locales.map((locale) => [
                        locale,
                        locale === routing.defaultLocale
                            ? `${baseUrl}/events`
                            : `${baseUrl}/${locale}/events`,
                    ]),
                ),
            },
        },
        {
            url: `${baseUrl}/users`,
            lastModified: new Date(),
            changeFrequency: "weekly" as const,
            priority: 0.7,
            alternates: {
                languages: Object.fromEntries(
                    routing.locales.map((locale) => [
                        locale,
                        locale === routing.defaultLocale
                            ? `${baseUrl}/users`
                            : `${baseUrl}/${locale}/users`,
                    ]),
                ),
            },
        },
        {
            url: `${baseUrl}/map`,
            lastModified: new Date(),
            changeFrequency: "weekly" as const,
            priority: 0.8,
            alternates: {
                languages: Object.fromEntries(
                    routing.locales.map((locale) => [
                        locale,
                        locale === routing.defaultLocale
                            ? `${baseUrl}/map`
                            : `${baseUrl}/${locale}/map`,
                    ]),
                ),
            },
        },
        {
            url: `${baseUrl}/search`,
            lastModified: new Date(),
            changeFrequency: "daily" as const,
            priority: 0.6,
            alternates: {
                languages: Object.fromEntries(
                    routing.locales.map((locale) => [
                        locale,
                        locale === routing.defaultLocale
                            ? `${baseUrl}/search`
                            : `${baseUrl}/${locale}/search`,
                    ]),
                ),
            },
        },
        {
            url: `${baseUrl}/sponsors`,
            lastModified: new Date(),
            changeFrequency: "monthly" as const,
            priority: 0.5,
            alternates: {
                languages: Object.fromEntries(
                    routing.locales.map((locale) => [
                        locale,
                        locale === routing.defaultLocale
                            ? `${baseUrl}/sponsors`
                            : `${baseUrl}/${locale}/sponsors`,
                    ]),
                ),
            },
        },
        {
            url: `${baseUrl}/terms-of-use`,
            lastModified: new Date("2025-04-13"),
            changeFrequency: "yearly" as const,
            priority: 0.3,
            alternates: {
                languages: Object.fromEntries(
                    routing.locales.map((locale) => [
                        locale,
                        locale === routing.defaultLocale
                            ? `${baseUrl}/terms-of-use`
                            : `${baseUrl}/${locale}/terms-of-use`,
                    ]),
                ),
            },
        },
        {
            url: `${baseUrl}/privacy-policy`,
            lastModified: new Date("2025-04-13"),
            changeFrequency: "yearly" as const,
            priority: 0.3,
            alternates: {
                languages: Object.fromEntries(
                    routing.locales.map((locale) => [
                        locale,
                        locale === routing.defaultLocale
                            ? `${baseUrl}/privacy-policy`
                            : `${baseUrl}/${locale}/privacy-policy`,
                    ]),
                ),
            },
        },
    ];

    // Dynamic club pages
    const clubs = await prisma.club.findMany({
        where: { isPrivate: false },
        select: {
            id: true,
            slug: true,
            updatedAt: true,
        },
    });

    const clubPages = clubs.map((club) => ({
        url: `${baseUrl}/clubs/${club.slug || club.id}`,
        lastModified: club.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
        alternates: {
            languages: Object.fromEntries(
                routing.locales.map((locale) => [
                    locale,
                    locale === routing.defaultLocale
                        ? `${baseUrl}/clubs/${club.slug || club.id}`
                        : `${baseUrl}/${locale}/clubs/${club.slug || club.id}`,
                ]),
            ),
        },
    }));

    // Dynamic event pages
    const events = await prisma.event.findMany({
        where: { isPrivate: false },
        select: {
            id: true,
            slug: true,
            updatedAt: true,
        },
    });

    const eventPages = events.map((event) => ({
        url: `${baseUrl}/events/${event.slug || event.id}`,
        lastModified: event.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.7,
        alternates: {
            languages: Object.fromEntries(
                routing.locales.map((locale) => [
                    locale,
                    locale === routing.defaultLocale
                        ? `${baseUrl}/events/${event.slug || event.id}`
                        : `${baseUrl}/${locale}/events/${event.slug || event.id}`,
                ]),
            ),
        },
    }));

    // Dynamic user pages
    const users = await prisma.user.findMany({
        select: {
            id: true,
            slug: true,
            updatedAt: true,
        },
    });

    const userPages = users.map((user) => ({
        url: `${baseUrl}/users/${user.slug || user.id}`,
        lastModified: user.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
        alternates: {
            languages: Object.fromEntries(
                routing.locales.map((locale) => [
                    locale,
                    locale === routing.defaultLocale
                        ? `${baseUrl}/users/${user.slug || user.id}`
                        : `${baseUrl}/${locale}/users/${user.slug || user.id}`,
                ]),
            ),
        },
    }));

    return [...staticPages, ...clubPages, ...eventPages, ...userPages];
}
