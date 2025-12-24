import { Router } from "../../lib/router";
import { adminClubsRouter } from "./clubs";
import { adminUnclaimedClubsRouter } from "./unclaimed-clubs";
import { adminUsersRouter } from "./users";

const adminRouter = new Router();

adminRouter.use(adminUsersRouter);
adminRouter.use(adminClubsRouter);
adminRouter.use(adminUnclaimedClubsRouter);

export { adminRouter };
