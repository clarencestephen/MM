"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Creation now lives on the homepage.
 * Redirect anyone who navigates to /create.
 */
export default function CreateRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return null;
}
