"use client";

import { useEffect, useState } from "react";

/** "Good morning, Asha", by the visitor's own clock. Renders "Hello" until it knows the time. */
export function Greeting({ name }: { name: string }) {
  const [part, setPart] = useState("Hello");
  useEffect(() => {
    const h = new Date().getHours();
    setPart(h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);
  return <>{part}{name ? `, ${name}` : ""}</>;
}
