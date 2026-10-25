import { runLogisticsAgent } from "./index.js";

async function main() {
  const message =
    "The projector in Room 204 is broken.";

  console.log("Sending report to OnCue...\n");

  const result = await runLogisticsAgent(message);

  console.log(
    "OnCue Logistics Analysis:\n",
    JSON.stringify(result, null, 2),
  );
}

main().catch((error) => {
  console.error("Agent test failed:", error);
  process.exitCode = 1;
});
