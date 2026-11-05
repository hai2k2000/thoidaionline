import { permanentRedirect } from "next/navigation";

export default function LegacyMobileAppPage() {
  permanentRedirect("/app");
}
