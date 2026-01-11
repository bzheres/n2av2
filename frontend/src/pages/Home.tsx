import { Link } from "react-router-dom";
export default function Home() {
  return (
    <div className="space-y-8">
      <div className="hero bg-base-200 rounded-3xl">
        <div className="hero-content flex-col">
          <h1 className="text-4xl font-extrabold">Notion → Anki, in minutes.</h1>
          <p className="opacity-80 max-w-2xl text-center">
            Upload a Notion Markdown export, generate cards, edit, export CSV to Anki. AI review is available on paid plans.
          </p>
          <div className="flex gap-2">
            <Link to="/workflow" className="btn btn-primary">Workflow</Link>
            <Link to="/instructions" className="btn btn-outline">Instructions</Link>
            <Link to="/account" className="btn">Account</Link>
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        {["Upload","Parse","Review","Edit","Export","Study"].map((x)=>(
          <div key={x} className="card bg-base-200 border border-base-100 rounded-2xl">
            <div className="card-body"><div className="font-semibold">{x}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
