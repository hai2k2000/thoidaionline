const SHA = /^[0-9a-f]{40}$/i;

export function parseReleaseLineage(text) {
  return Object.fromEntries(String(text).split(/\r?\n/).filter(Boolean).map((line) => {
    const index = line.indexOf("=");
    return index < 0 ? [line, ""] : [line.slice(0, index), line.slice(index + 1)];
  }));
}

export function assertReleaseLineage({
  candidateCommit,
  currentProductionCommit,
  integrationCommit,
  candidateBranch,
  candidateDescendsFromProduction,
  integrationContainsProduction,
}) {
  for (const [name, value] of Object.entries({ candidateCommit, currentProductionCommit, integrationCommit })) {
    if (!SHA.test(String(value || ""))) throw new Error(`${name} must be a 40-character commit SHA`);
  }
  if (!candidateDescendsFromProduction) {
    throw new Error(`candidate must descend from current production ${currentProductionCommit}`);
  }
  if (!integrationContainsProduction) {
    throw new Error(`integration/production must contain current production ${currentProductionCommit}`);
  }
  if (candidateBranch !== "integration/production") {
    throw new Error(`candidate must be built from integration/production, got ${candidateBranch || "unknown"}`);
  }
  return true;
}
