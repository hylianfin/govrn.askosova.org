import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { PollingDeskPage } from "@/components/polling/polling-desk-page";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user?.roles.includes("volunteer")) redirect("/dashboard");
  return <PollingDeskPage />;
}
