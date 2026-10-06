"use client";

interface ChatMessage {
  id: string;
  sender: "assistant" | "shopper";
  text: string;
}

interface AIChatHistoryProps {
  messages: ChatMessage[];
}

export default function AIChatHistory({ messages }: AIChatHistoryProps) {
  if (messages.length === 0) return null;

  return (
    <div className="w-full lg:w-[410px] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-2xl p-6 flex flex-col gap-4 font-manrope text-left border border-[#C5C5D9]/10 flex-grow">
      {/* Title */}
      <div className="flex items-center gap-2 border-b border-slate-50 pb-3">
        <span className="text-[#001BD2] text-xs">🤖</span>
        <span className="text-xs font-bold text-[#454656]/60 tracking-[1.2px] uppercase">
          REVIEW AI ASSISTANT HISTORY
        </span>
      </div>

      {/* Messages List */}
      <div className="flex flex-col gap-4 flex-grow overflow-y-auto max-h-[220px] pr-1">
        {messages.map((m) => {
          const isAssistant = m.sender === "assistant";
          return (
            <div
              key={m.id}
              className={`flex w-full ${isAssistant ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[280px] p-3 text-xs leading-[20px] ${
                  isAssistant
                    ? "bg-[#F2F3FF] text-[#131B2E] rounded-tr-[16px] rounded-br-[16px] rounded-bl-[16px]"
                    : "bg-[#001BD2] text-white rounded-tl-[16px] rounded-br-[16px] rounded-bl-[16px]"
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
