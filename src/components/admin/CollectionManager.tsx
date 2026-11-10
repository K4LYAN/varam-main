"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { ActionResult } from "@/app/admin/actions";
import { toast } from "@/store/toast";
import { Card } from "./ui";

/**
 * Generic list + inline editor used for categories and testimonials.
 */
export function CollectionManager<T extends { id: string }, D>({
  items,
  empty,
  toDraft,
  blank,
  renderRow,
  renderForm,
  onSave,
  onDelete,
  addLabel,
  deleteConfirm,
}: {
  items: T[];
  empty: string;
  toDraft: (item: T) => D;
  blank: D;
  renderRow: (item: T) => React.ReactNode;
  renderForm: (draft: D, set: (patch: Partial<D>) => void) => React.ReactNode;
  onSave: (id: string | null, draft: D) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
  addLabel: string;
  deleteConfirm: (item: T) => string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<{ id: string | null; draft: D } | null>(null);

  const save = () =>
    editing &&
    start(async () => {
      const res = await onSave(editing.id, editing.draft);
      if (!res.ok) return toast({ title: "Please check the form", description: res.error, tone: "warning" });
      toast({ title: "Saved", description: "Changes are live on the website." });
      setEditing(null);
      router.refresh();
    });

  const remove = (item: T) => {
    if (!window.confirm(deleteConfirm(item))) return;
    start(async () => {
      const res = await onDelete(item.id);
      toast(res.ok ? { title: "Deleted" } : { title: "Could not delete", description: res.error, tone: "warning" });
      router.refresh();
    });
  };

  return (
    <div className={pending ? "opacity-70" : ""}>
      {editing && (
        <Card className="mb-6 border-accent/50" title={editing.id ? "Edit" : addLabel}>
          {renderForm(editing.draft, (patch) => setEditing((e) => e && { ...e, draft: { ...e.draft, ...patch } }))}
          <div className="mt-5 flex gap-2">
            <button onClick={save} disabled={pending} className="btn btn-primary min-h-11">
              {pending ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(null)} className="btn btn-outline min-h-11">
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        </Card>
      )}
      {!editing && (
        <button onClick={() => setEditing({ id: null, draft: blank })} className="btn btn-primary mb-6 min-h-11">
          <Plus className="h-4 w-4" /> {addLabel}
        </button>
      )}
      <div className="divide-y divide-line rounded-2xl border border-line bg-white">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-4 p-4 sm:p-5">
            <div className="min-w-0 flex-1">{renderRow(item)}</div>
            <button onClick={() => setEditing({ id: item.id, draft: toDraft(item) })} className="grid h-9 w-9 place-items-center rounded-full hover:bg-cream" aria-label="Edit">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => remove(item)} className="grid h-9 w-9 place-items-center rounded-full text-copper hover:bg-copper/10" aria-label="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {!items.length && <p className="p-8 text-center text-sm text-muted">{empty}</p>}
      </div>
    </div>
  );
}
