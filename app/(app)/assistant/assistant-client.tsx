"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, Plus, Send, Sparkles, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useConversationMessages, useConversations, useSendChatMessage } from "@/hooks/use-assistant";
import type { ChatMessage } from "@/types/domain";

const SUGGESTED_QUESTIONS = [
  "今天工作重點？",
  "有哪些超期事項？",
  "本週有哪些風險？",
  "各部門分析如何？",
  "本月完成多少任務？",
  "最近有哪些高風險事項？",
];

export function AssistantClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [input, setInput] = React.useState("");
  const [pendingUserMessage, setPendingUserMessage] = React.useState<string | null>(null);

  const { data: conversations } = useConversations();
  const { data: messages } = useConversationMessages(conversationId);
  const sendMessage = useSendChatMessage();

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const autoSentRef = React.useRef(false);

  const handleSend = React.useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sendMessage.isPending) return;
      setPendingUserMessage(trimmed);
      setInput("");
      sendMessage.mutate(
        { conversation_id: conversationId ?? undefined, message: trimmed },
        {
          onSuccess: (data) => {
            setConversationId(data.conversationId);
            setPendingUserMessage(null);
          },
          onError: () => setPendingUserMessage(null),
        }
      );
    },
    [conversationId, sendMessage]
  );

  // Dashboard AI Assistant widget links here with ?q=<question> pre-filled.
  React.useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoSentRef.current) {
      autoSentRef.current = true;
      handleSend(q);
      router.replace("/assistant");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pendingUserMessage]);

  function startNewConversation() {
    setConversationId(null);
    setInput("");
  }

  const displayMessages = messages ?? [];
  const isEmpty = displayMessages.length === 0 && !pendingUserMessage;

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-4">
      <Card className="hidden w-64 shrink-0 gap-0 overflow-hidden py-0 md:flex md:flex-col">
        <div className="border-b p-3">
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={startNewConversation}>
            <Plus className="size-4" /> 新對話
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {(conversations ?? []).length === 0 && <p className="p-2 text-xs text-muted-foreground">尚無對話紀錄</p>}
          <div className="flex flex-col gap-1">
            {(conversations ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setConversationId(c.id)}
                className={cn(
                  "truncate rounded-xl px-2 py-1.5 text-left text-sm hover:bg-muted",
                  conversationId === c.id && "bg-muted font-medium"
                )}
              >
                {c.title ?? "新對話"}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="flex flex-1 flex-col gap-0 overflow-hidden py-0">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {isEmpty && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <Sparkles className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">我是 TaskFlow AI 助理</p>
                <p className="text-xs text-muted-foreground">可以問我今天的待辦、超期事項、部門分析、專案進度等問題。</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <Badge
                    key={q}
                    variant="outline"
                    className="cursor-pointer px-3 py-1.5 text-xs hover:bg-muted"
                    onClick={() => handleSend(q)}
                  >
                    {q}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {displayMessages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {pendingUserMessage && (
            <MessageBubble
              message={{
                id: "pending-user",
                role: "user",
                content: pendingUserMessage,
                toolCalls: null,
                createdAt: new Date().toISOString(),
              }}
            />
          )}

          {sendMessage.isPending && (
            <div className="flex items-center gap-2 pl-9 text-xs text-muted-foreground">
              <Bot className="size-4 animate-pulse" /> AI 思考中…
            </div>
          )}
        </div>

        <div className="border-t p-3">
          {!isEmpty && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.slice(0, 4).map((q) => (
                <Badge key={q} variant="outline" className="cursor-pointer text-xs hover:bg-muted" onClick={() => handleSend(q)}>
                  {q}
                </Badge>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex items-end gap-2"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              placeholder="輸入問題，例如「今天有哪些待辦？」"
              className="min-h-10 flex-1 resize-none"
              rows={1}
            />
            <Button type="submit" size="icon" disabled={sendMessage.isPending || !input.trim()}>
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex items-start gap-2", isUser && "flex-row-reverse")}>
      <Avatar className="size-7">
        <AvatarFallback>{isUser ? <UserIcon className="size-4" /> : <Bot className="size-4" />}</AvatarFallback>
      </Avatar>
      <div className={cn("flex max-w-[75%] flex-col gap-1", isUser && "items-end")}>
        <div
          className={cn(
            "whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          {message.content}
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <p className="text-[11px] text-muted-foreground">查詢了：{message.toolCalls.map((t) => t.name).join("、")}</p>
        )}
      </div>
    </div>
  );
}
