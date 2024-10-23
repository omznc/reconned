"use client";

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@components/ui/alert-dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import {
    createContext,
    useCallback,
    useContext,
    useReducer,
    useRef,
    type DetailedHTMLProps,
    type InputHTMLAttributes,
    type PropsWithoutRef,
    type ReactNode,
} from "react";

export const AlertDialogContext = createContext<
    (params: AlertAction) => Promise<AlertAction["type"] extends "alert" | "confirm" ? boolean : null | string>
>(async () => null);

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";

const defaultCancelButtonText = "Cancel";
const defaultActionButtonText = "Okay";

export type AlertAction =
    | {
        type: "alert";
        title: string;
        body?: string;
        cancelButton?: string;
        cancelButtonVariant?: ButtonVariant;
    }
    | {
        type: "confirm";
        title: string;
        body?: string;
        cancelButton?: string;
        actionButton?: string;
        cancelButtonVariant?: ButtonVariant;
        actionButtonVariant?: ButtonVariant;
    }
    | {
        type: "prompt";
        title: string;
        inputType?: "input" | "textarea";
        body?: string;
        cancelButton?: string;
        actionButton?: string;
        defaultValue?: string;
        cancelButtonVariant?: ButtonVariant;
        actionButtonVariant?: ButtonVariant;
        inputProps?: DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
    }
    | { type: "close"; };

interface AlertDialogState {
    open: boolean;
    title: string;
    body: string;
    type: "alert" | "confirm" | "prompt";
    inputType?: "input" | "textarea";
    cancelButton: string;
    actionButton: string;
    cancelButtonVariant: ButtonVariant;
    actionButtonVariant: ButtonVariant;
    defaultValue?: string;
    inputProps?: PropsWithoutRef<DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>>;
}

export function alertDialogReducer(state: AlertDialogState, action: AlertAction): AlertDialogState {
    switch (action.type) {
        case "close":
            return { ...state, open: false };
        case "alert":
        case "confirm":
        case "prompt":
            return {
                ...state,
                open: true,
                ...action,
                cancelButton:
                    action.cancelButton || (action.type === "alert" ? defaultActionButtonText : defaultCancelButtonText),
                actionButton: ("actionButton" in action && action.actionButton) || defaultActionButtonText,
                cancelButtonVariant: action.cancelButtonVariant || "default",
                actionButtonVariant: ("actionButtonVariant" in action && action.actionButtonVariant) || "default",
            };
        default:
            return state;
    }
}

export function AlertDialogProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [state, dispatch] = useReducer(alertDialogReducer, {
        open: false,
        title: "",
        body: "",
        type: "alert",
        cancelButton: defaultCancelButtonText,
        actionButton: defaultActionButtonText,
        cancelButtonVariant: "default",
        actionButtonVariant: "default",
    });

    const resolveRef = useRef<(tf: any) => void>(null);

    function close() {
        dispatch({ type: "close" });
        resolveRef.current?.(false);
    }

    function confirm(value?: string) {
        dispatch({ type: "close" });
        resolveRef.current?.(value ?? true);
    }

    const dialog = useCallback(async <T extends AlertAction>(params: T) => {
        dispatch(params);

        return new Promise<T["type"] extends "alert" | "confirm" ? boolean : null | string>((resolve) => {
            resolveRef.current = resolve;
        });
    }, []);

    return (
        <AlertDialogContext.Provider value={dialog}>
            {children}
            <AlertDialog
                open={state.open}
                onOpenChange={(open) => {
                    if (!open) close();
                    return;
                }}
            >
                <AlertDialogContent asChild>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            confirm(event.currentTarget.prompt?.value);
                        }}
                    >
                        <AlertDialogHeader>
                            <AlertDialogTitle>{state.title}</AlertDialogTitle>
                            {state.body ? <AlertDialogDescription>{state.body}</AlertDialogDescription> : null}
                        </AlertDialogHeader>
                        {state.type === "prompt" && (
                            <>
                                {!state.inputType ||
                                    (state.inputType === "input" && (
                                        <Input name="prompt" defaultValue={state.defaultValue} {...state.inputProps} />
                                    ))}

                                {state.inputType === "textarea" && (
                                    <>
                                        {/* @ts-ignore */}
                                        <Textarea name="prompt" defaultValue={state.defaultValue} {...state.inputProps} />
                                    </>
                                )}
                            </>
                        )}
                        <AlertDialogFooter className="gap-2">
                            <Button type="button" onClick={close} variant={state.cancelButtonVariant}>
                                {state.cancelButton}
                            </Button>
                            {state.type === "alert" ? null : (
                                <Button type="submit" variant={state.actionButtonVariant}>
                                    {state.actionButton}
                                </Button>
                            )}
                        </AlertDialogFooter>
                    </form>
                </AlertDialogContent>
            </AlertDialog>
        </AlertDialogContext.Provider>
    );
}

type Params<T extends "alert" | "confirm" | "prompt"> = Omit<Extract<AlertAction, { type: T; }>, "type"> | string;

export function useConfirm() {
    const dialog = useContext(AlertDialogContext);

    return useCallback(
        (params: Params<"confirm">) => {
            return dialog({
                ...(typeof params === "string" ? { title: params } : params),
                type: "confirm",
            });
        },
        [dialog],
    );
}

export function usePrompt() {
    const dialog = useContext(AlertDialogContext);

    return (params: Params<"prompt">) =>
        dialog({
            ...(typeof params === "string" ? { title: params } : params),
            type: "prompt",
        });
}

export function useAlert() {
    const dialog = useContext(AlertDialogContext);
    return (params: Params<"alert">) =>
        dialog({
            ...(typeof params === "string" ? { title: params } : params),
            type: "alert",
        });
}
