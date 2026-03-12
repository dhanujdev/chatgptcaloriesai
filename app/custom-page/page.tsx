"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell shell--empty">
      <div className="card empty-card">
        <h1>Calorie Command</h1>
        <p>This route is reserved for future app settings and preferences.</p>
        <Link href="/" className="cta" style={{ display: "inline-block", textDecoration: "none" }}>
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
