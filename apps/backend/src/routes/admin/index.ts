import { Router } from "@reconned/router";
import { adminMiddleware } from "../../lib/middlewares/admin";
import { adminAlliancesRouter } from "./alliances";
import { adminClubsRouter } from "./clubs";
import { adminFeatureFlagsRouter } from "./feature-flags";
import { adminReviewsRouter } from "./reviews";

import { adminTasksRouter } from "./tasks";

import { adminUnclaimedClubsRouter } from "./unclaimed-clubs";
import { adminUsersRouter } from "./users";

const adminRouter = new Router();

adminRouter.middleware(adminMiddleware);

adminRouter.use(adminUsersRouter);
adminRouter.use(adminClubsRouter);
adminRouter.use(adminUnclaimedClubsRouter);
adminRouter.use(adminTasksRouter);
adminRouter.use(adminAlliancesRouter);
adminRouter.use(adminFeatureFlagsRouter);
adminRouter.use(adminReviewsRouter);

export { adminRouter };
