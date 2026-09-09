import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const QUICK_QUESTIONS = [
  { label: "今天待辦", question: "今天有哪些待辦？" },
  { label: "超期任務", question: "哪些任務超期？" },
  { label: "本週摘要", question: "本週有哪些風險？" },
];

/** Dashboard shortcut into the AI Assistant (/assistant) — each chip
 * pre-fills and auto-sends one question via the ?q= param it reads. */
export function AiAssistantWidget() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
          <Bot className="size-4" /> AI 助理
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/assistant">
            開啟對話 <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">用自然語言詢問任務、進度與風險，或點選快速問題：</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((q) => (
            <Badge key={q.label} variant="outline" className="px-3 py-1.5 text-xs" asChild>
              <Link href={`/assistant?q=${encodeURIComponent(q.question)}`}>{q.label}</Link>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
