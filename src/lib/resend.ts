import { env } from "@/lib/env";
import { Resend } from "resend";

export const DEFAULT_FROM = "Airsoft BiH <noreply@safetpojskic.com>";
export const resend = new Resend(env.RESEND_API_KEY);
