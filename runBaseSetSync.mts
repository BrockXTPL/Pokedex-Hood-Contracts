import { syncBaseSetIndex } from "../server/services/indexOracle";

const result = await syncBaseSetIndex();
console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}
