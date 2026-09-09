import { redirect } from "next/navigation";

export default function Home() {
  // Phase 6.5 repositions this system as an Aviation Planning Operations
  // Center — /planning (not /dashboard) is now the main homepage.
  redirect("/planning");
}
