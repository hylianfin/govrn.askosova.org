import { getCurrentUser } from "@/lib/auth/session";
import { ProfileForm } from "@/components/forms/simple-forms";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  return (
    <ProfileForm initial={{
      fullName: user?.profile?.full_name ?? "",
      gradeLevel: user?.profile?.grade_level ?? null,
      homeroom: user?.profile?.homeroom ?? null,
    }} />
  );
}
