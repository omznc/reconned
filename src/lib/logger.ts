import "server-only";
import { Logger } from "next-axiom";

export const logger = new Logger({ source: "server" });
