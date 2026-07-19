import { Router } from "@reconned/router";
import { clubsAlliancesRouter } from "./alliances";
import { clubsAuditLogsRouter } from "./audit-logs";
import { clubsClaimRequestsRouter } from "./claim-requests";
import { clubsCoreRouter } from "./core";
import { clubsEventsRouter } from "./events";
import { clubsInstagramRouter } from "./instagram";
import { clubsInvitesRouter } from "./invites";
import { clubsMembersRouter } from "./members";
import { clubsPostsRouter } from "./posts";
import { clubsPurchasesRouter } from "./purchases";
import { clubsRulesRouter } from "./rules";
import { clubsStatsRouter } from "./stats";

const clubsRouter = new Router();

clubsRouter.use(clubsCoreRouter);
clubsRouter.use(clubsMembersRouter);
clubsRouter.use(clubsInvitesRouter);
clubsRouter.use(clubsPostsRouter);
clubsRouter.use(clubsInstagramRouter);
clubsRouter.use(clubsPurchasesRouter);
clubsRouter.use(clubsRulesRouter);
clubsRouter.use(clubsStatsRouter);
clubsRouter.use(clubsEventsRouter);
clubsRouter.use(clubsAlliancesRouter);
clubsRouter.use(clubsAuditLogsRouter);
clubsRouter.use(clubsClaimRequestsRouter);

export { clubsRouter };
