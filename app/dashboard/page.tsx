import { redirect } from "next/navigation";

// Students have nothing to do here any more; admins are sent to /admin by the layout.
export default function DashboardPage() {
  redirect("/");
}
