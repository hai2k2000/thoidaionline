export function installedApkVersion(userAgent) {
  const match = userAgent.match(/ThoidaiWorkApp\/(\d+\.\d+\.\d+)(?:\+(\d+))?/i);
  return match ? { version: match[1], versionCode: match[2] ? Number(match[2]) : null } : null;
}

export function isApkOlder(installed, latest) {
  if (installed.versionCode !== null) return installed.versionCode < latest.versionCode;
  const current = installed.version.split('.').map(Number);
  const available = latest.version.split(/[.+-]/).slice(0, 3).map(Number);
  for (let index = 0; index < 3; index++) {
    if (current[index] !== available[index]) return current[index] < available[index];
  }
  return false;
}
