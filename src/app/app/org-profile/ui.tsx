"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateOrgProfileAction,
  runOrgDiscoveryAction,
  decideOrgProfileUpdateAction,
  updateOrgReceiptSettingsAction,
  uploadOrgLogoAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/shared/cn";
import { toast } from "sonner";

const FIELD_LABELS: Record<string, string> = {
  website_url: "Website URL",
  mission: "Mission",
  programs: "Programs",
  impact: "Impact",
  leadership: "Leadership",
  service_area: "Service area",
  beneficiaries: "Beneficiaries",
  key_metrics: "Key metrics",
  receipt_address: "Receipt address",
  receipt_ein: "Receipt EIN",
  receipt_signer_name: "Receipt signer name",
  receipt_signer_title: "Receipt signer title",
  logo_url: "Logo URL",
};

const FIELD_ORDER = [
  "website_url",
  "mission",
  "programs",
  "impact",
  "leadership",
  "service_area",
  "beneficiaries",
  "key_metrics",
];

const LONG_FIELDS = new Set(["mission", "programs", "impact", "key_metrics", "receipt_address"]);

type MetricItem = { label?: string; value: string };

function labelForField(key: string) {
  return FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValueText(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(formatValueText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, val]) => {
        const text = formatValueText(val);
        return text ? `${labelForField(key)}: ${text}` : "";
      })
      .filter(Boolean)
      .join("; ");
  }
  return String(value);
}

function serializeKeyMetrics(value: any) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object" && "label" in item && "value" in item) {
          return `${String(item.label)}: ${String(item.value)}`;
        }
        return formatValueText(item);
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, val]) => {
        const text = formatValueText(val);
        return text ? `${labelForField(key)}: ${text}` : labelForField(key);
      })
      .filter(Boolean)
      .join("\n");
  }
  return String(value);
}

function normalizeMetricItems(value: any): MetricItem[] {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") {
    const lines = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];
    return lines.map((line) => {
      const idx = line.indexOf(":");
      if (idx > 0) {
        return { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
      }
      return { value: line };
    });
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return { value: item };
        if (item && typeof item === "object") {
          if ("label" in item && "value" in item) {
            return { label: String(item.label), value: String(item.value) };
          }
          const entries = Object.entries(item);
          if (entries.length === 1) {
            const [key, val] = entries[0];
            return { label: labelForField(key), value: formatValueText(val) };
          }
        }
        return { value: formatValueText(item) };
      })
      .filter((item) => item.value);
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, val]) => ({ label: labelForField(key), value: formatValueText(val) }))
      .filter((item) => item.value);
  }
  return [{ value: String(value) }];
}

function formatWebsiteUrl(value: string) {
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function renderKeyMetrics(value: any, emptyLabel: string) {
  const items = normalizeMetricItems(value);
  if (items.length === 0) return <span className="text-slate-400">{emptyLabel}</span>;
  if (items.length === 1 && !items[0].label) {
    return <p className="whitespace-pre-wrap text-sm text-slate-900">{items[0].value}</p>;
  }
  return (
    <ul className="space-y-1 text-sm text-slate-700">
      {items.map((item, idx) => (
        <li key={`${item.label || "metric"}-${idx}`} className="flex flex-wrap gap-2">
          {item.label ? <span className="font-medium text-slate-700">{item.label}</span> : null}
          {item.label ? <span className="text-slate-400">:</span> : null}
          <span>{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

function renderObjectList(value: Record<string, any>, emptyLabel: string) {
  const entries = Object.entries(value);
  if (entries.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm text-slate-700">
      {entries.map(([key, val]) => (
        <li key={key} className="flex flex-wrap gap-2">
          <span className="font-medium text-slate-700">{labelForField(key)}</span>
          <span className="text-slate-400">:</span>
          <span>{formatValueText(val) || emptyLabel}</span>
        </li>
      ))}
    </ul>
  );
}

function renderFieldValue(field: string, value: any, emptyLabel: string) {
  if (field === "key_metrics") {
    return renderKeyMetrics(value, emptyLabel);
  }

  if (value === null || value === undefined || value === "") {
    return <span className="text-slate-400">{emptyLabel}</span>;
  }

  if (field === "website_url") {
    const display = String(value);
    const href = formatWebsiteUrl(display);
    return (
      <a href={href} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline">
        {display}
      </a>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-400">{emptyLabel}</span>;
    }
    return (
      <ul className="space-y-1 text-sm text-slate-700">
        {value.map((item, idx) => (
          <li key={`${field}-${idx}`}>{formatValueText(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object") {
    const entries = Object.keys(value);
    if (entries.length === 0) {
      return <span className="text-slate-400">{emptyLabel}</span>;
    }
    const rendered = renderObjectList(value, emptyLabel);
    if (rendered) return rendered;
  }

  return <p className="whitespace-pre-wrap text-sm text-slate-900">{String(value)}</p>;
}

function getProposedFields(proposed: any) {
  if (!proposed || typeof proposed !== "object") return [];
  const keys = Object.keys(proposed);
  const ordered = FIELD_ORDER.filter((key) => key in proposed).concat(keys.filter((key) => !FIELD_ORDER.includes(key)));
  return ordered
    .map((key) => ({
      key,
      label: labelForField(key),
      value: proposed[key],
      wide: LONG_FIELDS.has(key),
    }))
    .filter((entry) => typeof entry.value !== "undefined");
}

export function OrgProfileEditor({ profile }: { profile: any }) {
  const [isPending, start] = useTransition();
  const [isEditing, setIsEditing] = useState(false);

  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url || "");
  const [mission, setMission] = useState(profile.mission || "");
  const [programs, setPrograms] = useState(profile.programs || "");
  const [impact, setImpact] = useState(profile.impact || "");
  const [leadership, setLeadership] = useState(profile.leadership || "");
  const [serviceArea, setServiceArea] = useState(profile.service_area || "");
  const [beneficiaries, setBeneficiaries] = useState(profile.beneficiaries || "");
  const [keyMetrics, setKeyMetrics] = useState(serializeKeyMetrics(profile.key_metrics));
  const lastProfileUpdatedAt = useRef(profile.updated_at || "");

  const resetFromProfile = useCallback(() => {
    setWebsiteUrl(profile.website_url || "");
    setMission(profile.mission || "");
    setPrograms(profile.programs || "");
    setImpact(profile.impact || "");
    setLeadership(profile.leadership || "");
    setServiceArea(profile.service_area || "");
    setBeneficiaries(profile.beneficiaries || "");
    setKeyMetrics(serializeKeyMetrics(profile.key_metrics));
  }, [profile]);

  useEffect(() => {
    const currentStamp = profile.updated_at || "";
    if (currentStamp !== lastProfileUpdatedAt.current) {
      lastProfileUpdatedAt.current = currentStamp;
      if (!isEditing) {
        resetFromProfile();
      }
    }
  }, [isEditing, profile.updated_at, resetFromProfile]);

  const fields = [
    { key: "website_url", label: "Website URL", value: websiteUrl },
    { key: "service_area", label: "Service area", value: serviceArea },
    { key: "beneficiaries", label: "Beneficiaries", value: beneficiaries },
    { key: "leadership", label: "Leadership", value: leadership },
    { key: "mission", label: "Mission", value: mission, wide: true },
    { key: "programs", label: "Programs", value: programs, wide: true },
    { key: "impact", label: "Impact", value: impact, wide: true },
    { key: "key_metrics", label: "Key metrics", value: keyMetrics, wide: true },
  ];

  return (
    <div className="space-y-4">
      {!isEditing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600">Approved fields used by agents and templates.</div>
          <Button type="button" variant="secondary" onClick={() => setIsEditing(true)}>
            Edit profile
          </Button>
        </div>
      ) : null}

      {isEditing ? (
        <form
          action={(fd) => {
            start(async () => {
              try {
                await updateOrgProfileAction(fd);
                toast.success("Profile saved");
                setIsEditing(false);
              } catch (e: any) {
                toast.error(e?.message || "Failed to save");
              }
            });
          }}
          className="space-y-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Website URL</label>
              <Input
                name="websiteUrl"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.org"
              />
              <div className="text-xs text-slate-500">Used for org discovery and context extraction.</div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Mission</label>
              <Textarea name="mission" value={mission} onChange={(e) => setMission(e.target.value)} rows={4} placeholder="What is your mission?" />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Programs</label>
              <Textarea
                name="programs"
                value={programs}
                onChange={(e) => setPrograms(e.target.value)}
                rows={4}
                placeholder="Key programs and services"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Impact</label>
              <Textarea
                name="impact"
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                rows={4}
                placeholder="Impact metrics, outcomes, beneficiaries"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Leadership</label>
              <Textarea
                name="leadership"
                value={leadership}
                onChange={(e) => setLeadership(e.target.value)}
                rows={3}
                placeholder="Key leaders or roles"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Service area</label>
              <Textarea
                name="serviceArea"
                value={serviceArea}
                onChange={(e) => setServiceArea(e.target.value)}
                rows={3}
                placeholder="Regions, geographies, or communities served"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Beneficiaries</label>
              <Textarea
                name="beneficiaries"
                value={beneficiaries}
                onChange={(e) => setBeneficiaries(e.target.value)}
                rows={3}
                placeholder="Who benefits from your programs"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Key metrics</label>
              <Textarea
                name="keyMetrics"
                value={keyMetrics}
                onChange={(e) => setKeyMetrics(e.target.value)}
                rows={4}
                placeholder="2023 households served: 1,200"
              />
              <div className="text-xs text-slate-500">One metric per line. Use "Label: value" format.</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={() => {
                resetFromProfile();
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className={cn("rounded-lg border bg-white p-4", field.wide ? "sm:col-span-2" : "")}>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{field.label}</div>
              <div className="mt-2">{renderFieldValue(field.key, field.value, "Not set")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReceiptSettings({ profile, orgName }: { profile: any; orgName?: string | null }) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [isUploading, startUpload] = useTransition();

  const [receiptAddress, setReceiptAddress] = useState(profile.receipt_address || "");
  const [receiptEIN, setReceiptEIN] = useState(profile.receipt_ein || "");
  const [receiptSignerName, setReceiptSignerName] = useState(profile.receipt_signer_name || "");
  const [receiptSignerTitle, setReceiptSignerTitle] = useState(profile.receipt_signer_title || "");
  const lastProfileUpdatedAt = useRef(profile.updated_at || "");

  const resetFromProfile = useCallback(() => {
    setReceiptAddress(profile.receipt_address || "");
    setReceiptEIN(profile.receipt_ein || "");
    setReceiptSignerName(profile.receipt_signer_name || "");
    setReceiptSignerTitle(profile.receipt_signer_title || "");
  }, [profile]);

  useEffect(() => {
    const currentStamp = profile.updated_at || "";
    if (currentStamp !== lastProfileUpdatedAt.current) {
      lastProfileUpdatedAt.current = currentStamp;
      resetFromProfile();
    }
  }, [profile.updated_at, resetFromProfile]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-white">
          {profile.logo_url ? (
            <img src={profile.logo_url} alt={orgName ? `${orgName} logo` : "Organization logo"} className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-slate-400">Logo</span>
          )}
        </div>

        <form
          action={(fd) => {
            startUpload(async () => {
              try {
                await uploadOrgLogoAction(fd);
                toast.success("Logo uploaded");
                router.refresh();
              } catch (e: any) {
                toast.error(e?.message || "Upload failed");
              }
            });
          }}
          className="space-y-2"
        >
          <input
            name="logo"
            type="file"
            accept="image/png,image/jpeg"
            className="block w-full rounded-lg border bg-white px-3 py-2 text-sm"
            required
          />
          <Button type="submit" disabled={isUploading}>
            {isUploading ? "Uploading…" : "Upload logo"}
          </Button>
          <div className="text-xs text-slate-500">PNG or JPG, max 2MB.</div>
        </form>
      </div>

      <form
        action={(fd) => {
          startSave(async () => {
            try {
              await updateOrgReceiptSettingsAction(fd);
              toast.success("Receipt settings saved");
              router.refresh();
            } catch (e: any) {
              toast.error(e?.message || "Failed to save receipt settings");
            }
          });
        }}
        className="grid gap-4 md:grid-cols-2"
      >
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium">Receipt organization name</label>
          <Input value={orgName || "Organization"} readOnly className="bg-slate-50" />
          <div className="text-xs text-slate-500">Pulled from organization settings.</div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Organization EIN</label>
          <Input
            name="receiptEIN"
            value={receiptEIN}
            onChange={(e) => setReceiptEIN(e.target.value)}
            placeholder="12-3456789"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Authorized signer name</label>
          <Input
            name="receiptSignerName"
            value={receiptSignerName}
            onChange={(e) => setReceiptSignerName(e.target.value)}
            placeholder="Jane Executive"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium">Organization address</label>
          <Textarea
            name="receiptAddress"
            value={receiptAddress}
            onChange={(e) => setReceiptAddress(e.target.value)}
            rows={3}
            placeholder="123 Main St\nWilmington, DE 19801"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Authorized signer title</label>
          <Input
            name="receiptSignerTitle"
            value={receiptSignerTitle}
            onChange={(e) => setReceiptSignerTitle(e.target.value)}
            placeholder="Executive Director"
          />
        </div>

        <div className="flex justify-end md:col-span-2">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save receipt settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function DiscoveryRunner() {
  const [isPending, start] = useTransition();

  return (
    <Button
      onClick={() => {
        start(async () => {
          try {
            await runOrgDiscoveryAction();
            toast.success("Discovery started in background.", {
              description: "We will notify you when it finishes.",
            });
          } catch (e: any) {
            toast.error(e?.message || "Discovery failed");
          }
        });
      }}
      disabled={isPending}
      className="w-full"
    >
      {isPending ? "Running..." : "Run discovery"}
    </Button>
  );
}

export function UpdatesList({ updates }: { updates: any[] }) {
  if (updates.length === 0) return <div className="text-sm text-slate-600">No suggested updates yet.</div>;

  return (
    <div className="space-y-4">
      {updates.map((u) => (
        <UpdateCard key={u.id} update={u} />
      ))}
    </div>
  );
}

function UpdateCard({ update }: { update: any }) {
  const [isPending, start] = useTransition();
  const status = update.status;
  const proposedFields = getProposedFields(update.proposed || {});

  const statusStyle =
    status === "accepted"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : status === "rejected"
        ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
        : "bg-amber-50 text-amber-700 ring-1 ring-amber-200";

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{update.summary || "Suggested updates"}</div>
          <div className="mt-1 text-xs text-slate-500">Proposed fields: {proposedFields.length}</div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide", statusStyle)}>
            {status}
          </span>
          <span>{new Date(update.created_at).toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {proposedFields.length > 0 ? (
          proposedFields.map((field) => (
            <div key={field.key} className={cn("rounded-lg border bg-slate-50 p-3", field.wide ? "sm:col-span-2" : "")}>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{field.label}</div>
              <div className="mt-2">{renderFieldValue(field.key, field.value, "Clear value")}</div>
            </div>
          ))
        ) : (
          <div className="text-sm text-slate-600">No field-level changes in this suggestion.</div>
        )}
      </div>

      {Array.isArray(update.sources) && update.sources.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
          {update.sources.map((source: any, idx: number) => {
            const label = String(source);
            const isUrl = /^https?:\/\//i.test(label);
            if (isUrl) {
              return (
                <a
                  key={`${label}-${idx}`}
                  href={label}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:border-slate-300 hover:text-slate-800"
                >
                  {label}
                </a>
              );
            }
            return (
              <span key={`${label}-${idx}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                {label}
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form
          action={(fd) => {
            start(async () => {
              try {
                await decideOrgProfileUpdateAction(fd);
                toast.success("Saved");
              } catch (e: any) {
                toast.error(e?.message || "Failed");
              }
            });
          }}
        >
          <input type="hidden" name="updateId" value={update.id} />
          <input type="hidden" name="decision" value="accept" />
          <Button type="submit" disabled={isPending || status !== "pending"}>
            Accept
          </Button>
        </form>

        <form
          action={(fd) => {
            start(async () => {
              try {
                await decideOrgProfileUpdateAction(fd);
                toast.success("Saved");
              } catch (e: any) {
                toast.error(e?.message || "Failed");
              }
            });
          }}
        >
          <input type="hidden" name="updateId" value={update.id} />
          <input type="hidden" name="decision" value="reject" />
          <Button type="submit" variant="secondary" disabled={isPending || status !== "pending"}>
            Reject
          </Button>
        </form>

        <div className="ml-auto text-xs text-slate-500">
          {update.agent_run_id ? `AI run: ${String(update.agent_run_id).slice(0, 8)}...` : "AI run: n/a"}
        </div>
      </div>
    </div>
  );
}
