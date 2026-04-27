"use client";

import { Copy, Key, Plus, Trash2 } from "lucide-react";
import { useExtracted } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ApiKey {
	id: string;
	name: string;
	prefix: string;
	expiresAt: string | null;
	createdAt: string;
	lastUsedAt: string | null;
}

export function McpSection() {
	const t = useExtracted();
	const [keys, setKeys] = useState<ApiKey[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [newKeyName, setNewKeyName] = useState("");
	const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

	const fetchKeys = useCallback(async () => {
		setIsLoading(true);
		try {
			const res = await fetch("/api/api-keys", { credentials: "include" });
			if (!res.ok) {
				toast.error(t("An error occurred"));
				return;
			}
			const data = await res.json();
			// Map apiKeys array to our expected shape
			const apiKeys = (data.apiKeys || []).map((k: Record<string, unknown>) => ({
				id: String(k.id),
				name: String(k.name || ""),
				prefix: String(k.prefix || k.start || ""),
				expiresAt: k.expiresAt ? String(k.expiresAt) : null,
				createdAt: String(k.createdAt),
				lastUsedAt: k.lastRequest ? String(k.lastRequest) : null,
			}));
			setKeys(apiKeys);
		} catch {
			toast.error(t("An error occurred"));
		} finally {
			setIsLoading(false);
		}
	}, [t]);

	useEffect(() => {
		fetchKeys();
	}, [fetchKeys]);

	async function handleCreateKey() {
		if (!newKeyName.trim()) return;

		setIsLoading(true);
		try {
			const res = await fetch("/api/api-keys", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: newKeyName.trim() }),
				credentials: "include",
			});

			const data = await res.json();

			if (!res.ok) {
				toast.error(data.error || t("An error occurred"));
				return;
			}

			setNewlyCreatedKey(String(data.key || ""));
			setNewKeyName("");
			await fetchKeys();
			toast.success(t("API key created"));
		} catch {
			toast.error(t("An error occurred"));
		} finally {
			setIsLoading(false);
		}
	}

	async function handleRevokeKey(keyId: string) {
		setIsLoading(true);
		try {
			const res = await fetch(`/api/api-keys/${keyId}/revoke`, {
				method: "POST",
				credentials: "include",
			});

			const data = await res.json();

			if (!res.ok) {
				toast.error(data.error || t("An error occurred"));
				return;
			}

			setNewlyCreatedKey(null);
			await fetchKeys();
			toast.success(t("API key revoked"));
		} catch {
			toast.error(t("An error occurred"));
		} finally {
			setIsLoading(false);
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		toast.success(t("Copied to clipboard"));
	}

	return (
		<div className="space-y-4">
			<div>
				<h3 className="text-lg font-semibold flex items-center gap-2">
					<Key className="h-5 w-5" />
					{t("API Keys")}
				</h3>
				<p className="text-sm text-muted-foreground mt-1">{t("Manage your API keys for MCP access")}</p>
			</div>

			<div className="flex gap-2">
				<Input
					placeholder={t("Key name")}
					value={newKeyName}
					onChange={(e) => setNewKeyName(e.target.value)}
					maxLength={50}
					disabled={isLoading}
				/>
				<Button onClick={handleCreateKey} disabled={!newKeyName.trim() || isLoading} size="sm">
					<Plus className="h-4 w-4 mr-1" />
					{t("Create API Key")}
				</Button>
			</div>

			{newlyCreatedKey && (
				<div className="rounded-lg border bg-card p-4">
					<div className="flex items-center justify-between mb-3">
						<div className="flex items-center gap-2">
							<div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
								<Key className="h-4 w-4 text-green-600 dark:text-green-400" />
							</div>
							<div>
								<p className="text-sm font-medium">{t("API key created")}</p>
								<p className="text-xs text-muted-foreground">
									{t("Make sure to copy your key now. You won't be able to see it again.")}
								</p>
							</div>
						</div>
						<Button variant="outline" size="sm" onClick={() => copyToClipboard(newlyCreatedKey)}>
							<Copy className="h-4 w-4 mr-1" />
							{t("Copy")}
						</Button>
					</div>
					<code className="block bg-muted rounded-md px-3 py-2 text-sm font-mono break-all">
						{newlyCreatedKey}
					</code>
				</div>
			)}

			<div className="text-sm text-muted-foreground">
				<p className="font-medium text-foreground mb-1">{t("How to use")}</p>
				<p>{t("Send requests with the X-API-Key header")}:</p>
				<code className="block bg-muted rounded-md px-3 py-2 text-sm font-mono mt-2">
					curl -H "X-API-Key: your-api-key" -H "Accept: text/event-stream" https://reconned.com/api/mcp
				</code>
				<p className="mt-2">
					{t("Endpoint")}: <code className="bg-muted px-1 py-0.5 rounded text-xs">POST /api/mcp</code>
				</p>
			</div>

			<div className="space-y-2">
				<h4 className="text-sm font-medium">{t("Your API Keys")}</h4>
				{keys.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("No API keys")}</p>
				) : (
					<div className="space-y-2">
						{keys.map((key) => (
							<div key={key.id} className="flex items-center justify-between rounded-lg border p-3">
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-medium text-sm truncate">{key.name}</span>
										<span className="text-xs text-muted-foreground font-mono">{key.prefix}...</span>
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										{t("Created")}: {new Date(key.createdAt).toLocaleDateString()}
										{key.lastUsedAt && (
											<span className="ml-2">
												{t("Last used")}: {new Date(key.lastUsedAt).toLocaleDateString()}
											</span>
										)}
									</div>
								</div>
								<div className="flex items-center gap-1 ml-2">
									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="text-destructive hover:text-destructive"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>{t("Revoke API Key")}</AlertDialogTitle>
												<AlertDialogDescription>{t("Delete key?")}</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
												<AlertDialogAction onClick={() => handleRevokeKey(key.id)}>
													{t("Revoke API Key")}
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
