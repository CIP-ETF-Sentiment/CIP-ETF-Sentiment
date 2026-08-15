"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type ChatMessage = { role: "user" | "model"; text: string };

export default function AgentChat() {
  const [open,setOpen] = useState(false);
  const [messages,setMessages] = useState<ChatMessage[]>([]);
  const [input,setInput] = useState("");
  const [loading,setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages,loading]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages: ChatMessage[] = [...messages,{role:"user",text}];
    setMessages(nextMessages); setInput(""); setLoading(true);
    try {
      const response = await fetch("/api/agent",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:text,history:messages.map(message=>({role:message.role,parts:[{text:message.text}]}))}),
      });
      const data = await response.json();
      setMessages([...nextMessages,{role:"model",text:response.ok?data.reply:`發生錯誤：${data.error ?? "未知錯誤"}`}]);
    } catch {
      setMessages([...nextMessages,{role:"model",text:"網路連線失敗，請稍後再試。"}]);
    } finally { setLoading(false); }
  }

  return <div className="agent-shell">
    {open&&<section className="agent-window" role="dialog" aria-label="CIP 小樹洞助理">
      <header><div className="agent-avatar">CIP</div><div><b>小樹洞助理</b><small><i /> ETF 趨勢資料已連線</small></div><button onClick={()=>setOpen(false)} aria-label="關閉助理">×</button></header>
      <div className="agent-messages">
        {messages.length===0&&<div className="agent-welcome"><span>✦</span><h3>想知道市場正在找什麼？</h3><p>我可以查詢五大 ETF 分類的熱門字詞、Z-score 與每週搜尋趨勢。</p><button onClick={()=>setInput("最近哪個主動式 ETF 關鍵字最熱門？")}>推薦一個問題</button></div>}
        {messages.map((message,index)=><div key={`${message.role}-${index}`} className={`agent-message ${message.role}`}>{message.text}</div>)}
        {loading&&<div className="agent-thinking"><i /><i /><i /></div>}
        <div ref={endRef}/>
      </div>
      <form onSubmit={send}><label><span>⌕</span><input value={input} onChange={event=>setInput(event.target.value)} placeholder="詢問 ETF 熱度、排行或趨勢…" aria-label="輸入 ETF 問題"/></label><button type="submit" disabled={loading||!input.trim()}>送出 ↗</button></form>
      <footer>資料來源｜Google Trends · Taiwan</footer>
    </section>}
    <button className="agent-launcher" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-label={open?"收合 CIP 小樹洞助理":"開啟 CIP 小樹洞助理"}><span>{open?"×":"✦"}</span><b>{open?"收合":"問小樹洞"}</b></button>
  </div>;
}
