export function shouldShowInstallApp({ pathname = "", standalone = false, iosStandalone = false, userAgent = "" } = {}) {
  return pathname !== "/app" && pathname !== "/app/" && !standalone && !iosStandalone && !/ThoidaiWorkApp/i.test(userAgent);
}

export function shouldRememberLoginDefault({ standalone = false, iosStandalone = false, userAgent = "" } = {}) {
  return standalone || iosStandalone || /ThoidaiWorkApp\//i.test(userAgent);
}
