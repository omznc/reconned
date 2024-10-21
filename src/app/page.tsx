'use client'

import {authClient} from "@/lib/auth-client";
import Link from "next/link";

export default function Home() {
  const {
    data: session,
    isPending,
    error
  } = authClient.useSession()

  return (
    <div className="flex flex-col">
      {session ? <button onClick={() => {}}>Logout</button> : <Link href="/login">Sign In</Link>}
      {isPending ? "Loading..." : error ? error.message : session ? `Hello ${session.user.name}` : "Please sign in"}
      {session && `Cao ${session.user.name}`}
    </div>
  );
}
