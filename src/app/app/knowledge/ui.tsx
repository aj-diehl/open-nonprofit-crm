"use client";

import { useEffect, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { deleteDocumentAction, uploadDocAction, type UploadDocState } from "./actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const initialState: UploadDocState = {};

export function UploadDocForm() {
  const [state, action] = useFormState(uploadDocAction, initialState);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <UploadDocFields error={state.error} />
    </form>
  );
}

function UploadDocFields({ error }: { error?: string }) {
  const { pending } = useFormStatus();

  return (
    <>
      {error ? (
        <Alert variant="error" className="w-full">
          {error}
        </Alert>
      ) : null}
      {pending ? (
        <Alert className="w-full">
          Uploading your document. Indexing continues in the background.
        </Alert>
      ) : null}
      <fieldset disabled={pending} className="contents">
        <input
          name="file"
          type="file"
          accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls"
          className="block rounded-lg border bg-white px-3 py-2 text-sm"
          required
        />
        <Input name="tags" placeholder="Tags (comma-separated)" className="min-w-[220px]" />
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading..." : "Upload & queue"}
        </Button>
      </fieldset>
    </>
  );
}

const AUTO_REFRESH_MS = 5000;

export function KnowledgeAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      router.refresh();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, router]);

  return null;
}

export function DeleteDocumentButton({ documentId, redirectTo }: { documentId: string; redirectTo: string }) {
  const [isPending, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const currentPath = query ? `${pathname}?${query}` : pathname;

  return (
    <form
      action={(fd) => {
        start(async () => {
          if (!confirm("Delete this document? This removes the file and its indexed chunks.")) return;
          try {
            await deleteDocumentAction(fd);
            toast.success("Document deleted");
            if (redirectTo && redirectTo !== currentPath) {
              router.push(redirectTo);
            }
            router.refresh();
          } catch (e: any) {
            toast.error(e?.message || "Failed to delete document");
          }
        });
      }}
    >
      <input type="hidden" name="id" value={documentId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Button type="submit" variant="ghost" disabled={isPending} className="text-rose-600 hover:text-rose-700">
        {isPending ? "Deleting..." : "Delete"}
      </Button>
    </form>
  );
}
