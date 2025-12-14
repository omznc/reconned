import type { z } from "zod";

export type RouteContext = {
	user?: { id: string; email: string; name: string; role?: string };
	session?: { id: string };
	isAdmin: boolean;
};

export type RouteHandlerParams<
	TBody = undefined,
	TQuery = undefined,
	TSchema extends RouteSchema | undefined = undefined,
> = TBody extends undefined
	? TQuery extends undefined
		? {
				request: Request;
				params: Record<string, string>;
				query: URLSearchParams;
				context: RouteContext;
				response: ResponseHelper<TSchema>;
			}
		: {
				request: Request;
				params: Record<string, string>;
				query: URLSearchParams;
				validatedQuery: TQuery;
				context: RouteContext;
				response: ResponseHelper<TSchema>;
			}
	: TQuery extends undefined
		? {
				request: Request;
				params: Record<string, string>;
				query: URLSearchParams;
				context: RouteContext;
				validatedBody: TBody;
				response: ResponseHelper<TSchema>;
			}
		: {
				request: Request;
				params: Record<string, string>;
				query: URLSearchParams;
				validatedQuery: TQuery;
				context: RouteContext;
				validatedBody: TBody;
				response: ResponseHelper<TSchema>;
			};

export type RouteHandler<TBody = undefined, TQuery = undefined, TSchema extends RouteSchema | undefined = undefined> = (
	params: RouteHandlerParams<TBody, TQuery, TSchema>,
) => Promise<Response> | Response;

type ResponseSchema = Record<number | string, z.ZodTypeAny>;

export type RouteSchema = {
	params?: z.ZodTypeAny;
	query?: z.ZodTypeAny;
	body?: z.ZodTypeAny;
	response?: ResponseSchema;
	summary?: string;
	description?: string;
	tags?: string[];
};

export function responseSchema(codes: number[], schema: z.ZodTypeAny): ResponseSchema {
	const result: ResponseSchema = {};
	for (const code of codes) {
		result[code] = schema;
	}
	return result;
}

type InferBodyType<TSchema extends RouteSchema | undefined> = TSchema extends { body: z.ZodTypeAny }
	? z.infer<TSchema["body"]>
	: undefined;

export type InferQueryType<TSchema extends RouteSchema | undefined> = TSchema extends {
	query: z.ZodTypeAny;
}
	? z.infer<TSchema["query"]>
	: undefined;

export type InferResponseType<TSchema extends RouteSchema | undefined> = TSchema extends {
	response: ResponseSchema;
}
	? TSchema["response"][200] extends z.ZodTypeAny
		? z.infer<TSchema["response"][200]>
		: TSchema["response"]["200"] extends z.ZodTypeAny
			? z.infer<TSchema["response"]["200"]>
			: unknown
	: unknown;

export type InferSuccessResponseType<TSchema extends RouteSchema | undefined> = TSchema extends {
	response: ResponseSchema;
}
	? TSchema["response"][201] extends z.ZodTypeAny
		? z.infer<TSchema["response"][201]>
		: TSchema["response"]["201"] extends z.ZodTypeAny
			? z.infer<TSchema["response"]["201"]>
			: TSchema["response"][200] extends z.ZodTypeAny
				? z.infer<TSchema["response"][200]>
				: TSchema["response"]["200"] extends z.ZodTypeAny
					? z.infer<TSchema["response"]["200"]>
					: unknown
	: unknown;

export type InferErrorResponseType<
	TSchema extends RouteSchema | undefined,
	TStatus extends 400 | 401 | 403 | 404 | 500,
> = TSchema extends {
	response: ResponseSchema;
}
	? TSchema["response"][TStatus] extends z.ZodTypeAny
		? z.infer<TSchema["response"][TStatus]>
		: TSchema["response"][`${TStatus}`] extends z.ZodTypeAny
			? z.infer<TSchema["response"][`${TStatus}`]>
			: unknown
	: unknown;

export type ResponseHelper<TSchema extends RouteSchema | undefined> = {
	json: <TStatus extends 200 | 201 = 200>(
		data: TStatus extends 201 ? InferSuccessResponseType<TSchema> : InferResponseType<TSchema>,
		status?: TStatus,
	) => Response;
	error: <TStatus extends 400 | 401 | 403 | 404 | 500 = 400>(
		data: InferErrorResponseType<TSchema, TStatus>,
		status?: TStatus,
	) => Response;
	redirect: (url: string, status?: 301 | 302) => Response;
};

export type Route<TBody = undefined> = {
	method: string;
	path: string;
	handler: RouteHandler<TBody>;
	auth?: boolean;
	schema?: RouteSchema;
};

export class Router {
	public routes: Route[] = [];

	add<TBody = undefined, TQuery = undefined, TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: RouteHandler<TBody, TQuery, TSchema>,
		options?: { auth?: boolean; schema?: RouteSchema },
	) {
		this.routes.push({
			method: method.toUpperCase(),
			path,
			handler: handler as RouteHandler<TBody>,
			auth: options?.auth,
			schema: options?.schema,
		} as Route);
		return this;
	}

	private createResponseHelper<TSchema extends RouteSchema | undefined>(_schema?: TSchema): ResponseHelper<TSchema> {
		return {
			json: <TStatus extends 200 | 201 = 200>(
				data: TStatus extends 201 ? InferSuccessResponseType<TSchema> : InferResponseType<TSchema>,
				status: TStatus = 200 as TStatus,
			): Response => {
				return jsonResponse(data, status);
			},
			error: <TStatus extends 400 | 401 | 403 | 404 | 500 = 400>(
				data: InferErrorResponseType<TSchema, TStatus>,
				status: TStatus = 400 as TStatus,
			): Response => {
				return jsonResponse(data, status);
			},
			redirect: (url: string, status: 301 | 302 = 302): Response => {
				return new Response(null, {
					status,
					headers: { Location: url },
				});
			},
		};
	}

	private wrapHandler<TSchema extends RouteSchema | undefined>(
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema>,
		) => Promise<Response> | Response,
		schema?: TSchema,
	): RouteHandler<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema> {
		return (params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema>) => {
			return handler({
				...params,
				response: this.createResponseHelper(schema),
			});
		};
	}

	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema>,
		) => Promise<Response> | Response,
		options?: { auth?: boolean; schema?: TSchema },
	): this {
		return this.add(
			method,
			path,
			this.wrapHandler(handler, options?.schema) as RouteHandler<
				InferBodyType<TSchema>,
				InferQueryType<TSchema>,
				TSchema
			>,
			options,
		);
	}

	get<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema>,
		) => Promise<Response> | Response,
		options?: { auth?: boolean; schema?: TSchema },
	): this {
		return this.registerMethod("GET", path, handler, options);
	}

	post<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema>,
		) => Promise<Response> | Response,
		options?: { auth?: boolean; schema?: TSchema },
	): this {
		return this.registerMethod("POST", path, handler, options);
	}

	put<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema>,
		) => Promise<Response> | Response,
		options?: { auth?: boolean; schema?: TSchema },
	): this {
		return this.registerMethod("PUT", path, handler, options);
	}

	delete<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema>,
		) => Promise<Response> | Response,
		options?: { auth?: boolean; schema?: TSchema },
	): this {
		return this.registerMethod("DELETE", path, handler, options);
	}

	match(request: Request): { route: Route; params: Record<string, string> } | null {
		const url = new URL(request.url);
		const pathname = url.pathname;
		const method = request.method.toUpperCase();

		for (const route of this.routes) {
			if (route.method !== method) {
				continue;
			}

			const params = this.matchPath(route.path, pathname);
			if (params !== null) {
				return { route, params };
			}
		}

		return null;
	}

	private matchPath(pattern: string, pathname: string): Record<string, string> | null {
		const patternParts = pattern.split("/").filter(Boolean);
		const pathParts = pathname.split("/").filter(Boolean);

		if (patternParts.length !== pathParts.length) {
			return null;
		}

		const params: Record<string, string> = {};

		for (let i = 0; i < patternParts.length; i++) {
			const patternPart = patternParts[i];
			const pathPart = pathParts[i];

			if (!patternPart || !pathPart) {
				return null;
			}

			if (patternPart.startsWith(":")) {
				const paramName = patternPart.slice(1);
				params[paramName] = decodeURIComponent(pathPart);
			} else if (patternPart !== pathPart) {
				return null;
			}
		}

		return params;
	}
}

export function jsonResponse<T = unknown>(data: T, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

export async function parseBody(request: Request): Promise<unknown> {
	const contentType = request.headers.get("content-type");
	if (contentType?.includes("application/json")) {
		return await request.json();
	}
	return null;
}
