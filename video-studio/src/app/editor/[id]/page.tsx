import { Suspense } from "react";
import { EditorShell } from "@/components/editor/EditorShell";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={null}><EditorShell projectId={id} /></Suspense>;
}
