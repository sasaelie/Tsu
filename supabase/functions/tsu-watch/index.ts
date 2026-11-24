import { buildFocus, collectWeek, nextWeek } from "./collect.ts";

const url=Deno.env.get("SUPABASE_URL");
const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});

async function database(path:string,init:RequestInit={}) {
  const response=await fetch(url+"/rest/v1/"+path,{...init,signal:AbortSignal.timeout(10000),headers:{
    apikey:key!,Authorization:"Bearer "+key,"Content-Type":"application/json",...init.headers
  }});
  if (!response.ok) throw new Error("Journal database HTTP "+response.status);
  const body=await response.text();
  return body?JSON.parse(body):null;
}

function monday(value:unknown): value is string {
  return typeof value==="string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(value).getUTCDay()===1 && new Date(value).toISOString().slice(0,10)===value;
}

async function readPublications(url:URL) {
  const week=url.searchParams.get("week");
  if (week!==null) {
    if (!monday(week)) return json({error:"Use a Monday date"},400);
    const rows=await database("tsu_watch_publications?select=week,contents,published_at&week=eq."+week);
    return json({publication:rows[0]??null});
  }
  const publications=[];
  for (let offset=0;;offset+=1000) {
    const rows=await database("tsu_watch_publications?select=week,published_at,focus:contents->focus,releases:contents->items"+
      "&order=week.desc&limit=1000&offset="+offset);
    for (const row of rows) {
      publications.push({week:row.week,published_at:row.published_at,
        focus:row.focus ? {format:row.focus.format,release:{title:row.focus.release.title}} : null,
        count:row.releases.length});
    }
    if (rows.length<1000) break;
  }
  return json({publications});
}

Deno.serve(async req=>{
  if (!["GET","POST"].includes(req.method)) return json({error:"Method not allowed"},405);
  const candidate=req.headers.get("x-tsu-watch-token") ?? "";
  if (!/^[a-f0-9]{64}$/.test(candidate)) return json({error:"Unauthorized"},401);
  const writer=req.method==="POST";
  try {
    const allowed=await database("rpc/tsu_watch_authorized",{method:"POST",body:JSON.stringify({candidate,is_writer:writer})});
    if (allowed!==true) return json({error:"Unauthorized"},401);
    if (!writer) {
      const query=new URL(req.url);
      if (query.searchParams.get("view")==="published") return await readPublications(query);
      const [drafts,runs]=await Promise.all([
        database("tsu_watch_drafts?select=week,contents,collected_at&order=week.desc&limit=8"),
        database("tsu_watch_runs?select=week,checked_at,count,sources,decision&order=id.desc&limit=1")
      ]);
      return json({drafts,runs});
    }
    const input=await req.json();
    const week=input.week ?? nextWeek();
    if (!monday(week)) return json({error:"Use a Monday date"},400);
    if (input.scheduled===true) {
      const hour=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Brussels",hour:"2-digit",hourCycle:"h23"}).format();
      if (hour!=="18") return json({skipped:"Outside the scheduled Brussels hour"});
    }
    const [collection,prior]=await Promise.all([
      collectWeek(week),
      database("tsu_watch_publications?select=series:contents->focus->>series&week=lt."+week+"&order=week.desc&limit=10")
    ]);
    const {edition,sources,issues,news}=collection;
    const verified=edition.items.filter(item=>item.official || item.also?.length);
    const manga=verified.filter(item=>item.kind==="manga").length;
    const anime=verified.filter(item=>item.kind==="anime").length;
    const focus=buildFocus({...edition,items:verified},prior.map((row:{series:string|null})=>row.series).filter(Boolean),news);
    const ready=manga>=3 && anime>=2;
    const decision=!ready ? "review" : input.dryRun===true ? "dry-run" : "published";
    if (issues.length) sources.push({name:"Dates contradictoires écartées",ok:false,count:issues.length,error:issues.join(", ").slice(0,120)});
    if (edition.items.length) {
      await database("tsu_watch_drafts?on_conflict=week",{method:"POST",
        headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({week,contents:edition,collected_at:new Date().toISOString()})});
    }
    if (decision==="published") {
      await database("tsu_watch_publications?on_conflict=week",{method:"POST",
        headers:{Prefer:"resolution=ignore-duplicates"},body:JSON.stringify({week,contents:{...edition,items:verified,focus}})});
    }
    await database("tsu_watch_runs",{method:"POST",body:JSON.stringify({week,count:edition.items.length,sources,decision})});
    return json({status:decision,week,manga,anime,focus:focus?.format??null,sources});
  } catch(error) {
    console.error("TSŪ watch",error instanceof Error ? error.message : "unknown");
    return json({error:"Watch service unavailable"},502);
  }
});
