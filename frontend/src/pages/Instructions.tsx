import React from "react";
const PAGES = [
  { title: "Q&A format", body: "Question: <text>\n    <answer lines indented>" },
  { title: "MCQ format", body: "MCQ: <stem>\n    <options...>\nAnswer:\n    <correct option>" },
  { title: "Export", body: "Export CSV and import to Anki." },
];
export default function Instructions() {
  const [i,setI] = React.useState(0);
  const p=PAGES[i];
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <progress className="progress" value={i+1} max={PAGES.length}></progress>
      <div className="card bg-base-200 rounded-2xl border border-base-100">
        <div className="card-body">
          <h2 className="card-title text-2xl">{p.title}</h2>
          <pre className="whitespace-pre-wrap opacity-80">{p.body}</pre>
          <div className="flex justify-between mt-3">
            <button className="btn" disabled={i===0} onClick={()=>setI(i-1)}>Back</button>
            <button className="btn btn-primary" disabled={i===PAGES.length-1} onClick={()=>setI(i+1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
