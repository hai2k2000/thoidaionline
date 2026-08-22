import { redirect } from "next/navigation";
export default function LegacyMyDutySchedulePage() { redirect("/duty-schedule?scope=personal"); }
