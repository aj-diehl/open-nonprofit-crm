"use client";

import { useTransition } from "react";
import { decideUserAction } from "./actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function UsersTable({ users }: { users: any[] }) {
  const [isPending, start] = useTransition();

  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-3 py-2">User</th>
            <th className="px-3 py-2">Role</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const identifier = u.contact_email || (u.username ? `@${u.username}` : null);
            return (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{u.display_name}</div>
                  {identifier ? <div className="text-xs text-slate-600">{identifier}</div> : null}
                </td>
              <td className="px-3 py-2">{u.role}</td>
              <td className="px-3 py-2">
                <span
                  className={
                    "font-medium " +
                    (u.status === "active"
                      ? "text-success"
                      : u.status === "pending"
                        ? "text-warning"
                        : "text-danger")
                  }
                >
                  {u.status}
                </span>
              </td>
              <td className="px-3 py-2">{new Date(u.created_at).toLocaleDateString()}</td>
              <td className="px-3 py-2 text-right">
                {u.status === "pending" ? (
                  <form
                    action={(fd) => {
                      start(async () => {
                        try {
                          await decideUserAction(fd);
                          toast.success("User approved");
                        } catch (e: any) {
                          toast.error(e?.message || "Failed");
                        }
                      });
                    }}
                    className="inline"
                  >
                    <input type="hidden" name="profileId" value={u.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <Button type="submit" disabled={isPending}>
                      Approve
                    </Button>
                  </form>
                ) : null}

                {u.status === "active" ? (
                  <form
                    action={(fd) => {
                      start(async () => {
                        try {
                          await decideUserAction(fd);
                          toast.success("User disabled");
                        } catch (e: any) {
                          toast.error(e?.message || "Failed");
                        }
                      });
                    }}
                    className="ml-2 inline"
                  >
                    <input type="hidden" name="profileId" value={u.id} />
                    <input type="hidden" name="decision" value="disable" />
                    <Button type="submit" variant="secondary" disabled={isPending}>
                      Disable
                    </Button>
                  </form>
                ) : null}
              </td>
              </tr>
            );
          })}
          {users.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-slate-600" colSpan={5}>
                No users found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="text-xs text-slate-500">
        Disabling a user prevents data access, but does not delete records.
      </div>
    </div>
  );
}
