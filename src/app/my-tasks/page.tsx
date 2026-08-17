import { redirect } from "next/navigation";
import {
  buildLegacyTaskRedirectFromParams,
  type LegacySearchParams,
} from "@/components/phase2Navigation";

type LegacyRedirectPageProps = {
  searchParams: Promise<LegacySearchParams>;
};

export default async function LegacyRedirectPage({
  searchParams,
}: LegacyRedirectPageProps) {
  redirect(buildLegacyTaskRedirectFromParams("/my-tasks", await searchParams));
}
