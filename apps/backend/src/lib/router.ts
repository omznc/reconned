import type { z } from "zod";

export type RouteContext<TAuth extends boolean = false> = {
	user: TAuth extends true
		? { id: string; email: string; name: string; role?: string }
		: { id: string; email: string; name: string; role?: string } | undefined;
	session?: { id: string };
	isAdmin: boolean;
};

type BaseHandlerParams<TSchema extends RouteSchema | undefined, TAuth extends boolean> = {
	request: Request;
	params: Record<string, string>;
	query: URLSearchParams;
	context: RouteContext<TAuth>;
	response: ResponseHelper<TSchema>;
};

type WithBody<T> = T extends undefined ? unknown : { validatedBody: T };
type WithQuery<T> = T extends undefined ? unknown : { validatedQuery: T };

export type RouteHandlerParams<
	TBody = undefined,
	TQuery = undefined,
	TSchema extends RouteSchema | undefined = undefined,
	TAuth extends boolean = false,
> = BaseHandlerParams<TSchema, TAuth> & WithBody<TBody> & WithQuery<TQuery>;

export type RouteHandler<
	TBody = undefined,
	TQuery = undefined,
	TSchema extends RouteSchema | undefined = undefined,
	TAuth extends boolean = false,
> = (params: RouteHandlerParams<TBody, TQuery, TSchema, TAuth>) => Promise<Response> | Response;

type HandlerFn<TSchema extends RouteSchema | undefined, TAuth extends boolean> = (
	params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, TAuth>,
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

type InferResponseCode<TSchema extends RouteSchema | undefined, TCode extends number | string> = TSchema extends {
	response: ResponseSchema;
}
	? TSchema["response"][TCode] extends z.ZodTypeAny
		? z.infer<TSchema["response"][TCode]>
		: TSchema["response"][`${TCode}`] extends z.ZodTypeAny
			? z.infer<TSchema["response"][`${TCode}`]>
			: unknown
	: unknown;

export type InferResponseType<TSchema extends RouteSchema | undefined> = InferResponseCode<TSchema, 200>;

type Has201<TSchema extends RouteSchema | undefined> = TSchema extends { response: ResponseSchema }
	? TSchema["response"][201] extends z.ZodTypeAny
		? true
		: TSchema["response"]["201"] extends z.ZodTypeAny
			? true
			: false
	: false;

export type InferSuccessResponseType<TSchema extends RouteSchema | undefined> = Has201<TSchema> extends true
	? InferResponseCode<TSchema, 201>
	: InferResponseCode<TSchema, 200>;

export type InferErrorResponseType<
	TSchema extends RouteSchema | undefined,
	TStatus extends 400 | 401 | 403 | 404 | 500,
> = InferResponseCode<TSchema, TStatus>;

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

	private wrapHandler<TSchema extends RouteSchema | undefined, TAuth extends boolean>(
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, TAuth>,
		) => Promise<Response> | Response,
		schema?: TSchema,
		_auth?: boolean,
	): RouteHandler<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, TAuth> {
		return (params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, TAuth>) => {
			return handler({
				...params,
				response: this.createResponseHelper(schema),
			});
		};
	}

	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: HandlerFn<TSchema, true>,
		options?: { auth?: true; schema?: TSchema },
	): this;
	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: HandlerFn<TSchema, false>,
		options?: { auth?: false; schema?: TSchema },
	): this;
	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: HandlerFn<TSchema, boolean>,
		options?: { auth?: boolean; schema?: TSchema },
	): this;
	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: HandlerFn<TSchema, boolean>,
		options?: { auth?: boolean; schema?: TSchema },
	): this {
		return this.add(
			method,
			path,
			this.wrapHandler(handler, options?.schema, options?.auth) as RouteHandler<
				InferBodyType<TSchema>,
				InferQueryType<TSchema>,
				TSchema,
				boolean
			>,
			options,
		);
	}

	get<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, true>,
		options: { auth: true; schema?: TSchema },
	): this;
	get<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, false>,
		options?: { auth?: false; schema?: TSchema },
	): this;
	get<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, boolean>,
		options?: { auth?: boolean; schema?: TSchema },
	): this {
		return this.registerMethod("GET", path, handler, options);
	}

	post<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, true>,
		options: { auth: true; schema?: TSchema },
	): this;
	post<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, false>,
		options?: { auth?: false; schema?: TSchema },
	): this;
	post<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, boolean>,
		options?: { auth?: boolean; schema?: TSchema },
	): this {
		return this.registerMethod("POST", path, handler, options);
	}

	put<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, true>,
		options: { auth: true; schema?: TSchema },
	): this;
	put<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, false>,
		options?: { auth?: false; schema?: TSchema },
	): this;
	put<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, boolean>,
		options?: { auth?: boolean; schema?: TSchema },
	): this {
		return this.registerMethod("PUT", path, handler, options);
	}

	delete<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, true>,
		options: { auth: true; schema?: TSchema },
	): this;
	delete<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, false>,
		options?: { auth?: false; schema?: TSchema },
	): this;
	delete<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, boolean>,
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
