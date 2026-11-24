import { redirect } from "next/navigation";
import { getGovAccess } from "@/lib/queries/government";

// Government members land in their working console after signing in.
export default async function DashboardPage() {
  const access = await getGovAccess();
  if (access?.seat) redirect("/government");
  redirect("/");
}
