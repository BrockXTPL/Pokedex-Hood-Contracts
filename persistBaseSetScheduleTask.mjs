import { getMarketBySlug, setMarketScheduleTaskUid } from "../server/db.ts";

const taskUid = process.env.BASE_SET_SCHEDULE_TASK_UID;

if (!taskUid) {
  throw new Error("BASE_SET_SCHEDULE_TASK_UID is required");
}

const market = await getMarketBySlug("base-set");
if (!market) {
  throw new Error("Base Set market was not found");
}

await setMarketScheduleTaskUid(market.id, taskUid);

console.log(
  JSON.stringify({
    ok: true,
    market: market.slug,
    marketId: market.id,
    taskUid,
  })
);
