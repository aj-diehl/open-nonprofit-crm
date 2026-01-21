import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GrantArchiveButton, GrantQuestions, DraftGenerator, GuidelinesUploader, GrantDeleteButton, GrantProcessForm } from "./ui";
import { formatCurrency } from "@/lib/shared/money";

export default async function GrantDetailPage({ params }: { params: { id: string } }) {
  const grantId = params.id;
  const supabase = createSupabaseServerClient();
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  const isExec = viewer?.profile?.role === "executive";

  const { data: grant } = await supabase.from("grants").select("*").eq("id", grantId).eq("org_id", orgId).single();
  if (!grant) return notFound();

  const awardedAmountMin = grant.awarded_amount_min !== null && grant.awarded_amount_min !== undefined ? Number(grant.awarded_amount_min) : null;
  const awardedAmountMax = grant.awarded_amount_max !== null && grant.awarded_amount_max !== undefined ? Number(grant.awarded_amount_max) : null;
  const isArchived = Boolean(grant.archived_at);

  const { data: questions } = await supabase
    .from("grant_questions")
    .select("id, question, constraints, max_words, created_at")
    .eq("org_id", orgId)
    .eq("grant_id", grantId)
    .order("created_at", { ascending: true });

  const questionIds = (questions || []).map((q) => q.id);
  const { data: answers } =
    questionIds.length > 0
      ? await supabase
          .from("grant_answers")
          .select("id, question_id, draft, final, citations, confidence, updated_at")
          .eq("org_id", orgId)
          .in("question_id", questionIds)
      : { data: [] as any[] };

  const answerByQuestion = new Map<string, any>();
  for (const a of answers || []) answerByQuestion.set(a.question_id, a);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-slate-600">Grant</div>
          <h1 className="text-2xl font-semibold">{grant.title}</h1>
          <div className="mt-1 text-sm text-slate-600">
            {grant.funder ? <span className="mr-2">{grant.funder}</span> : null}
            <span className="mr-2">·</span>
            <span className="mr-2">
              Stage: <span className="font-medium text-slate-900">{formatGrantStage(grant.status)}</span>
            </span>
            {grant.status === "awarded" || grant.status === "declined" ? (
              <>
                <span className="mr-2">·</span>
                <span>
                  Outcome: <span className="font-medium text-slate-900">{formatOutcome(grant.status)}</span>
                </span>
              </>
            ) : null}
            {grant.due_date ? (
              <>
                <span className="mr-2">·</span>
                <span>Due {new Date(grant.due_date).toLocaleDateString()}</span>
              </>
            ) : null}
            {grant.requested_amount ? (
              <>
                <span className="mr-2">·</span>
                <span>Request {formatCurrency(Number(grant.requested_amount))}</span>
              </>
            ) : null}
            {grant.status === "awarded" && (awardedAmountMin !== null || awardedAmountMax !== null) ? (
              <>
                <span className="mr-2">·</span>
                <span>Award {formatAwardRange(awardedAmountMin, awardedAmountMax)}</span>
              </>
            ) : null}
          </div>
        </div>

        <Link href="/app/grants">
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      {isArchived ? (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="text-sm text-amber-900">This grant is archived. Restore it to resume active tracking.</div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="font-medium">Questions & answers</div>
              <div className="mt-1 text-sm text-slate-600">
                Add questions manually or upload guidelines and then generate drafts with organizational context.
              </div>
            </div>
            <DraftGenerator grantId={grantId} disabled={!questions || questions.length === 0} />
          </div>

          <div className="mt-6">
            <GrantQuestions
              grantId={grantId}
              questions={questions || []}
              answerByQuestion={Object.fromEntries(answerByQuestion)}
            />
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="font-medium">Grant status</div>
            <div className="mt-2 text-sm text-slate-600">Track progress and record the verdict outcome.</div>
            <div className="mt-4">
              <GrantProcessForm
                grantId={grantId}
                status={grant.status}
                awardedAmountMin={awardedAmountMin}
                awardedAmountMax={awardedAmountMax}
              />
            </div>
          </Card>

          <Card className="p-6">
            <div className="font-medium">Archive</div>
            <div className="mt-2 text-sm text-slate-600">
              Archived grants are hidden from the main list but still retrievable.
            </div>
            <div className="mt-4">
              <GrantArchiveButton grantId={grantId} isArchived={isArchived} />
            </div>
          </Card>
          <Card className="p-6">
            <div className="font-medium">Guidelines files</div>
            <div className="mt-2 text-sm text-slate-600">
              Upload the grant RFP / application PDF. It will be added to your organization knowledge base for better answers.
            </div>
            <div className="mt-4">
              <GuidelinesUploader grantId={grantId} />
            </div>
          </Card>

          <Card className="p-6">
            <div className="font-medium">Lifecycle checklist</div>
            <ul className="mt-3 list-disc pl-5 text-sm text-slate-600">
              <li>Identify eligibility and constraints</li>
              <li>Draft narrative answers (AI-assisted)</li>
              <li>Review compliance, finalize, and submit</li>
              <li>Track award/decline</li>
              <li>Manage reporting obligations and deliverables</li>
            </ul>
          </Card>

          {isExec ? (
            <Card className="p-6">
              <div className="font-medium">Danger zone</div>
              <div className="mt-2 text-sm text-slate-600">Deleting a grant removes questions, answers, and linked records.</div>
              <div className="mt-4">
                <GrantDeleteButton grantId={grantId} canDelete={isExec} />
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatGrantStage(status: string) {
  if (status === "submitted") return "Submitted";
  if (["awarded", "declined", "reporting", "closed"].includes(status)) return "Verdict rendered";
  return "Draft";
}

function formatOutcome(status: string) {
  if (status === "awarded") return "Awarded";
  if (status === "declined") return "Declined";
  return "Verdict";
}

function formatAwardRange(min: number | null, max: number | null) {
  if (min !== null && min !== undefined && max !== null && max !== undefined) {
    if (min === max) return formatCurrency(Number(min));
    return `${formatCurrency(Number(min))}–${formatCurrency(Number(max))}`;
  }
  if (min !== null && min !== undefined) return formatCurrency(Number(min));
  if (max !== null && max !== undefined) return formatCurrency(Number(max));
  return "—";
}
