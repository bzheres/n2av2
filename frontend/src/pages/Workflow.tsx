import React from "react";
import UploadBox from "../components/UploadBox";
import { me } from "../auth";

type Card = { card_type:"qa"|"mcq"; front:string; back:string; };

function parseMarkdown(md: string): Card[] {
  const lines = md.split(/\r?\n/);
  const norm = (l:string)=> {
    const s=l.trim().toLowerCase();
    if(s.startsWith("question:")||s.startsWith("quesition:")||s.startsWith("quesiton:")) return "question";
    if(s.startsWith("mcq:")||s.startsWith("mcu:")) return "mcq";
    return null;
  };
  const out: Card[] = [];
  let i=0;
  while(i<lines.length){
    const tag = norm(lines[i]);
    if(!tag){ i++; continue; }
    if(tag==="question"){
      const q=lines[i].split(":",2)[1].trim(); i++;
      const ans:string[]=[];
      while(i<lines.length){
        if(norm(lines[i])) break;
        const nxt=lines[i];
        if(/^(\s{4}|\t|-\s|\*\s)/.test(nxt)){ ans.push(nxt.replace(/^(\s{4}|\t|-\s|\*\s)/,"").trimEnd()); i++; continue; }
        if(nxt.trim()===""){ if(ans.length) ans.push(""); i++; continue; }
        if(ans.length) break;
        i++;
      }
      out.push({card_type:"qa", front:q, back: ans.join("\n").trim()});
      continue;
    }
    if(tag==="mcq"){
      const stem=lines[i].split(":",2)[1].trim(); i++;
      const opts:string[]=[]; let ans=""; let inAns=false;
      while(i<lines.length){
        if(norm(lines[i])) break;
        const nxt=lines[i];
        if(nxt.trim()===""){ i++; continue; }
        if(nxt.trim().toLowerCase().startsWith("answer:")){ inAns=true; i++; continue; }
        if(inAns){
          if(/^(\s{4}|\t)/.test(nxt)){ ans=nxt.trim(); i++; continue; }
          break;
        }
        if(/^(\s{4}|\t|-\s|\*\s)/.test(nxt)){ opts.push(nxt.replace(/^(\s{4}|\t|-\s|\*\s)/,"").trimEnd()); i++; continue; }
        break;
      }
      out.push({card_type:"mcq", front: opts.length? `${stem}\n${opts.join("\n")}`:stem, back: ans.trim()});
      continue;
    }
  }
  return out;
}

export default function Workflow(){
  const [user,setUser]=React.useState<any>(null);
  const [raw,setRaw]=React.useState(""); const [filename,setFilename]=React.useState("");
  const [cards,setCards]=React.useState<Card[]>([]);
  React.useEffect(()=>{ me().then(r=>setUser(r.user)).catch(()=>setUser(null)); },[]);
  return (
    <div className="space-y-4">
      <UploadBox onFile={(t,n)=>{setRaw(t); setFilename(n); setCards([]);}} />
      <div className="flex gap-2 flex-wrap">
        <button className="btn btn-primary" disabled={!raw} onClick={()=>setCards(parseMarkdown(raw))}>Parse</button>
        <button className="btn btn-outline" onClick={()=>{setRaw('');setFilename('');setCards([]);}}>Clear</button>
        <button className="btn btn-secondary" disabled={!cards.length} onClick={()=>{
          const rows=[["Front","Back"],...cards.map(c=>[c.front,c.back])];
          const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
          const blob=new Blob([csv],{type:"text/csv"});
          const url=URL.createObjectURL(blob);
          const a=document.createElement("a"); a.href=url; a.download=(filename?filename.replace(/\.md$/i,""):"n2a")+".csv"; a.click();
          URL.revokeObjectURL(url);
        }}>Export CSV</button>
      </div>
      <div className="alert"><span>{user?`Logged in (${user.plan})`:"Guest mode: parse/edit/export works. Login to subscribe + AI."}</span></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c,idx)=>(
          <div key={idx} className="card bg-base-200 rounded-2xl border border-base-100">
            <div className="card-body">
              <div className="badge badge-outline">{c.card_type.toUpperCase()}</div>
              <div className="text-sm font-semibold">Front</div>
              <pre className="whitespace-pre-wrap text-sm">{c.front}</pre>
              <div className="text-sm font-semibold">Back</div>
              <pre className="whitespace-pre-wrap text-sm opacity-90">{c.back}</pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
