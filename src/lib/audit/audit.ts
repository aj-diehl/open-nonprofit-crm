export type AuditEvent = {
  orgId: string;
  actorId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
};

export async function audit(supabase: any, event: AuditEvent) {
  try {
    await supabase.from("audit_events").insert({
      org_id: event.orgId,
      actor_id: event.actorId,
      action: event.action,
      entity_type: event.entityType || null,
      entity_id: event.entityId || null,
      metadata: event.metadata || null,
    });
  } catch {
    // Swallow audit errors — do not break critical flows.
  }
}
