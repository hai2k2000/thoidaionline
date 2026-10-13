import { REQUIRED_API_CONTRACTS, resolveContractPath, validateContractResponse } from "./required-api-contracts.mjs";

const baseUrl = (process.env.THOIDAI_SMOKE_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const cookie = process.env.THOIDAI_SMOKE_COOKIE || "";
const bearer = process.env.THOIDAI_SMOKE_BEARER || "";
if (!cookie && !bearer) {
  console.error("authenticated smoke credentials are unavailable; set THOIDAI_SMOKE_COOKIE or THOIDAI_SMOKE_BEARER");
  process.exit(2);
}
const headers = { accept: "application/json", ...(cookie ? { cookie } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) };
const failures = [];
const sessionContract = REQUIRED_API_CONTRACTS.find((contract) => contract.name === "session");
const sessionResponse = await fetch(`${baseUrl}${resolveContractPath(sessionContract)}`, { headers });
const sessionBody = await sessionResponse.json().catch(() => null);
const sessionResult = validateContractResponse(sessionContract, sessionResponse, sessionBody);
if (!sessionResult.ok) {
  console.error(sessionResult.reason);
  process.exit(1);
}
const sessionUser = sessionBody.user;
for (const contract of REQUIRED_API_CONTRACTS) {
  if (contract.name === "session") {
    console.log(`PASS ${contract.name}`);
    continue;
  }
  const path = resolveContractPath(contract);
  const response = await fetch(`${baseUrl}${path}`, { headers });
  const body = await response.json().catch(() => null);
  const result = validateContractResponse(contract, response, body, { sessionUser });
  if (!result.ok) failures.push(result.reason);
  else console.log(`PASS ${contract.name}`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`authenticated-contracts: PASS (${REQUIRED_API_CONTRACTS.length})`);


