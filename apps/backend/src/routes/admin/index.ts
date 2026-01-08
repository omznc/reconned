import { Router } from "../../lib/router";
import { adminClubsRouter } from "./clubs";
<<<<<<< HEAD
=======
import { adminTasksRouter } from "./tasks";
>>>>>>> dev
import { adminUnclaimedClubsRouter } from "./unclaimed-clubs";
import { adminUsersRouter } from "./users";

const adminRouter = new Router();

adminRouter.use(adminUsersRouter);
adminRouter.use(adminClubsRouter);
adminRouter.use(adminUnclaimedClubsRouter);
<<<<<<< HEAD
=======
adminRouter.use(adminTasksRouter);
>>>>>>> dev

export { adminRouter };
