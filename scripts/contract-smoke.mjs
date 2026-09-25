import { REQUIRED_API_CONTRACTS, validateContractResponse } from "./required-api-contracts.mjs";

const baseUrl = (process.env.THOIDAI_SMOKE_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const cookie = process.env.THOIDAI_SMOKE_COOKIE || "";
const bearer = process.env.THOIDAI_SMOKE_BEARER || "";
if (!cookie && !bearer) {
  console.error("authenticated smoke credentials are unavailable; set THOIDAI_SMOKE_COOKIE or THOIDAI_SMOKE_BEARER");
  process.exit(2);
}
const headers = { accept: "application/json", ...(cookie ? { cookie } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) };
const failures = [];
for (const contract of REQUIRED_API_CONTRACTS) {
  const response = await fetch(`${baseUrl}${contract.path}`, { headers });
  const body = await response.json().catch(() => null);
  const result = validateContractResponse(contract, response, body);
  if (!result.ok) failures.push(result.reason);
  else console.log(`PASS ${contract.name}`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`authenticated-contracts: PASS (${REQUIRED_API_CONTRACTS.length})`);


