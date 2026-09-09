import type { FollowupWithAuthor } from "@/types/domain";

export function FollowupTimeline({ followups }: { followups: FollowupWithAuthor[] }) {
  if (!followups.length) {
    return <p className="text-sm text-muted-foreground">尚無追蹤紀錄，點右上角「新增追蹤紀錄」開始記錄。</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {followups.map((f) => (
        <li key={f.id} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{f.followup_date}</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {f.department_name && (
                <span className="rounded-full bg-muted px-2 py-0.5">{f.department_name}</span>
              )}
              <span>{f.author?.name ?? "—"}</span>
            </div>
          </div>
          <p className="mt-2 text-sm">{f.content}</p>
          {f.result && (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">結果：</span>
              {f.result}
            </p>
          )}
          {f.next_action && (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">下一步：</span>
              {f.next_action}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
