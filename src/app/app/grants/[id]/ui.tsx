"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGrantQuestionAction,
  archiveGrantAction,
  deleteGrantAction,
  deleteGrantQuestionAction,
  generateGrantDraftsAction,
  restoreGrantAction,
  saveFinalGrantAnswerAction,
  updateGrantProcessAction,
  uploadGrantGuidelinesAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function DraftGenerator({ grantId, disabled }: { grantId: string; disabled?: boolean }) {
  const [isPending, start] = useTransition();
  return (
    <form
      action={(fd) => {
        start(async () => {
          try {
            await generateGrantDraftsAction(fd);
            toast.success("Draft generation started in background.", {
              description: "We will notify you when the drafts are ready.",
            });
          } catch (e: any) {
            toast.error(e?.message || "Failed to generate drafts");
          }
        });
      }}
    >
      <input type="hidden" name="grantId" value={grantId} />
      <Button type="submit" disabled={disabled || isPending}>
        {isPending ? "Generating…" : "Generate drafts"}
      </Button>
    </form>
  );
}

export function GuidelinesUploader({ grantId }: { grantId: string }) {
  const [isPending, start] = useTransition();
  return (
    <form
      action={(fd) => {
        start(async () => {
          try {
            await uploadGrantGuidelinesAction(fd);
            toast.success("Guidelines uploaded. Indexing runs in the background.");
          } catch (e: any) {
            toast.error(e?.message || "Upload failed");
          }
        });
      }}
      className="space-y-3"
    >
      <input type="hidden" name="grantId" value={grantId} />
      <input
        name="file"
        type="file"
        accept=".pdf,.doc,.docx,.txt,.md"
        className="block w-full rounded-lg border bg-white px-3 py-2 text-sm"
        required
      />
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Uploading…" : "Upload guidelines"}
      </Button>
    </form>
  );
}

export function GrantQuestions({
  grantId,
  questions,
  answerByQuestion,
  canDelete = true,
}: {
  grantId: string;
  questions: any[];
  answerByQuestion: Record<string, any>;
  canDelete?: boolean;
}) {
  const [q, setQ] = useState("");
  const [constraints, setConstraints] = useState("");
  const [maxWords, setMaxWords] = useState<string>("");

  const [isPending, start] = useTransition();

  return (
    <div className="space-y-6">
      <form
        action={(fd) => {
          start(async () => {
            try {
              await addGrantQuestionAction(fd);
              setQ("");
              setConstraints("");
              setMaxWords("");
              toast.success("Question added");
            } catch (e: any) {
              toast.error(e?.message || "Failed to add question");
            }
          });
        }}
        className="rounded-xl border bg-slate-50 p-4 space-y-3"
      >
        <input type="hidden" name="grantId" value={grantId} />
        <div className="text-sm font-medium">Add question</div>
        <Textarea name="question" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Paste a grant question…" required rows={3} />
        <div className="grid gap-3 md:grid-cols-2">
          <Input name="constraints" value={constraints} onChange={(e) => setConstraints(e.target.value)} placeholder="Constraints (optional)" />
          <Input name="maxWords" value={maxWords} onChange={(e) => setMaxWords(e.target.value)} placeholder="Max words (optional)" />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add question"}
        </Button>
      </form>

      <div className="space-y-4">
        {questions.map((q) => {
          const a = answerByQuestion[q.id];
          return (
            <QuestionCard key={q.id} grantId={grantId} question={q} answer={a} canDelete={canDelete} />
          );
        })}
        {questions.length === 0 ? <div className="text-sm text-slate-600">No questions yet.</div> : null}
      </div>
    </div>
  );
}

function QuestionCard({
  grantId,
  question,
  answer,
  canDelete = false,
}: {
  grantId: string;
  question: any;
  answer?: any;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [finalText, setFinalText] = useState(answer?.final || "");

  const draft = answer?.draft || "";
  const citations = Array.isArray(answer?.citations) ? answer.citations : [];

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-sm font-medium">{question.question}</div>
        {canDelete ? (
          <form
            action={(fd) => {
              startDelete(async () => {
                if (!confirm("Delete this question and its drafts?")) return;
                try {
                  await deleteGrantQuestionAction(fd);
                  toast.success("Question deleted");
                  router.refresh();
                } catch (e: any) {
                  toast.error(e?.message || "Failed to delete question");
                }
              });
            }}
          >
            <input type="hidden" name="grantId" value={grantId} />
            <input type="hidden" name="questionId" value={question.id} />
            <Button type="submit" variant="ghost" disabled={isDeleting}>
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </form>
        ) : null}
      </div>
      {question.constraints ? <div className="mt-1 text-xs text-slate-600">Constraints: {question.constraints}</div> : null}
      {question.max_words ? <div className="mt-1 text-xs text-slate-600">Max words: {question.max_words}</div> : null}

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="text-xs font-medium text-slate-600">Draft (AI)</div>
          <div className="mt-2 whitespace-pre-wrap rounded-lg border bg-slate-50 p-3 text-sm text-slate-800">
            {draft ? draft : <span className="text-slate-500">No draft yet.</span>}
          </div>
          {citations.length > 0 ? (
            <div className="mt-2 text-xs text-slate-600">
              Citations:{" "}
              {citations.map((c: any, idx: number) => (
                <span key={idx} className="mr-2 rounded bg-slate-100 px-2 py-1">
                  {String(c)}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <div className="text-xs font-medium text-slate-600">Final (editable)</div>
          <form
            action={(fd) => {
              start(async () => {
                try {
                  await saveFinalGrantAnswerAction(fd);
                  toast.success("Saved");
                } catch (e: any) {
                  toast.error(e?.message || "Failed to save");
                }
              });
            }}
            className="mt-2 space-y-2"
          >
            <input type="hidden" name="answerId" value={answer?.id || ""} />
            <input type="hidden" name="grantId" value={grantId} />
            <Textarea
              name="finalText"
              value={finalText}
              onChange={(e) => setFinalText(e.target.value)}
              placeholder="Edit the final answer here…"
              rows={8}
            />
            <Button type="submit" disabled={isPending || !answer?.id}>
              {isPending ? "Saving…" : "Save final"}
            </Button>
            {!answer?.id ? (
              <div className="text-xs text-slate-500">Generate drafts first to create answer records.</div>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}

export function GrantProcessForm({
  grantId,
  status,
  awardedAmountMin,
  awardedAmountMax,
}: {
  grantId: string;
  status: string;
  awardedAmountMin?: number | null;
  awardedAmountMax?: number | null;
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();

  const { stage, outcome } = useMemo(() => {
    if (status === "submitted") return { stage: "submitted", outcome: "awarded" };
    if (["awarded", "reporting", "closed"].includes(status)) return { stage: "verdict", outcome: "awarded" };
    if (status === "declined") return { stage: "verdict", outcome: "declined" };
    return { stage: "draft", outcome: "awarded" };
  }, [status]);

  const [currentStage, setCurrentStage] = useState(stage);
  const [currentOutcome, setCurrentOutcome] = useState(outcome);
  const [minAmount, setMinAmount] = useState(awardedAmountMin ?? "");
  const [maxAmount, setMaxAmount] = useState(awardedAmountMax ?? "");

  const showVerdictFields = currentStage === "verdict";
  const showAmountFields = showVerdictFields && currentOutcome === "awarded";

  useEffect(() => {
    setCurrentStage(stage);
    setCurrentOutcome(outcome);
    setMinAmount(awardedAmountMin ?? "");
    setMaxAmount(awardedAmountMax ?? "");
  }, [stage, outcome, awardedAmountMin, awardedAmountMax]);

  return (
    <form
      action={(fd) => {
        start(async () => {
          try {
            await updateGrantProcessAction(fd);
            toast.success("Grant updated");
            router.refresh();
          } catch (e: any) {
            toast.error(e?.message || "Failed to update grant");
          }
        });
      }}
      className="space-y-3"
    >
      <input type="hidden" name="grantId" value={grantId} />

      <div className="space-y-2">
        <label className="text-sm font-medium">Stage</label>
        <select
          name="stage"
          value={currentStage}
          onChange={(e) => setCurrentStage(e.target.value)}
          className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
        >
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="verdict">Verdict rendered</option>
        </select>
      </div>

      {showVerdictFields ? (
        <div className="space-y-2">
          <label className="text-sm font-medium">Outcome</label>
          <select
            name="outcome"
            value={currentOutcome}
            onChange={(e) => setCurrentOutcome(e.target.value)}
            className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
          >
            <option value="awarded">Awarded</option>
            <option value="declined">Declined</option>
          </select>
        </div>
      ) : null}

      {showAmountFields ? (
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Awarded amount (min, USD)</label>
            <Input
              name="awardedAmountMin"
              type="number"
              step="0.01"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="25000"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Awarded amount (max, USD)</label>
            <Input
              name="awardedAmountMax"
              type="number"
              step="0.01"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              placeholder="50000"
            />
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save status"}
        </Button>
      </div>
    </form>
  );
}

export function GrantArchiveButton({ grantId, isArchived }: { grantId: string; isArchived: boolean }) {
  const router = useRouter();
  const [isPending, start] = useTransition();

  return (
    <form
      action={(fd) => {
        start(async () => {
          try {
            if (isArchived) await restoreGrantAction(fd);
            else await archiveGrantAction(fd);
            toast.success(isArchived ? "Grant restored" : "Grant archived");
            router.refresh();
          } catch (e: any) {
            toast.error(e?.message || "Failed to update grant");
          }
        });
      }}
    >
      <input type="hidden" name="grantId" value={grantId} />
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Working…" : isArchived ? "Restore grant" : "Archive grant"}
      </Button>
    </form>
  );
}

export function GrantDeleteButton({ grantId, canDelete }: { grantId: string; canDelete?: boolean }) {
  const router = useRouter();
  const [isDeleting, startDelete] = useTransition();

  if (!canDelete) return null;

  return (
    <form
      action={(fd) => {
        if (!confirm("Delete this grant and all associated questions/answers? This cannot be undone.")) return;
        startDelete(async () => {
          try {
            await deleteGrantAction(fd);
            toast.success("Grant deleted");
            router.push("/app/grants");
            router.refresh();
          } catch (e: any) {
            toast.error(e?.message || "Failed to delete grant");
          }
        });
      }}
    >
      <input type="hidden" name="grantId" value={grantId} />
      <Button type="submit" variant="ghost" disabled={isDeleting}>
        {isDeleting ? "Deleting…" : "Delete grant"}
      </Button>
    </form>
  );
}
