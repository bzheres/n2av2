import React from "react";
export default function UploadBox({ onFile }: { onFile: (text: string, filename: string) => void }) {
  const [drag, setDrag] = React.useState(false);
  async function handle(file: File) { const text = await file.text(); onFile(text, file.name); }
  return (
    <div className={`border-2 border-dashed rounded-2xl p-6 ${drag ? "border-primary bg-base-200" : "border-base-300"}`}
      onDragOver={(e)=>{e.preventDefault(); setDrag(true);}}
      onDragLeave={()=>setDrag(false)}
      onDrop={(e)=>{e.preventDefault(); setDrag(false); const f=e.dataTransfer.files?.[0]; if(f) handle(f);}}>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="font-semibold">Drop a .md file</div>
        <input className="file-input file-input-bordered w-full max-w-md" type="file" accept=".md,text/markdown"
          onChange={(e)=>{const f=e.target.files?.[0]; if(f) handle(f);}} />
      </div>
    </div>
  );
}
