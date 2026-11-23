import { collectWeek, nextWeek } from "./collect.ts";

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

Deno.serve(async req=>{
  if (!["GET","POST"].includes(req.method)) return json({error:"Method not allowed"},405);
  const candidate=req.headers.get("x-tsu-watch-token") ?? "";
  if (!/^[a-f0-9]{64}$/.test(candidate)) return json({error:"Unauthorized"},401);
  const writer=req.method==="POST";
  try {
    const allowed=await database("rpc/tsu_watch_authorized",{method:"POST",body:JSON.stringify({candidate,is_writer:writer})});
    if (allowed!==true) return json({error:"Unauthorized"},401);
    if (!writer) {
      const [drafts,runs]=await Promise.all([
        database("tsu_watch_drafts?select=week,contents,collected_at&order=week.desc&limit=8"),
        database("tsu_watch_runs?select=week,checked_at,count,sources&order=id.desc&limit=1")
      ]);
      return json({drafts,runs});
    }
    const input=await req.json();
    const week=input.week ?? nextWeek();
    if (typeof week!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(week) || new Date(week).getUTCDay()!==1 ||
        new Date(week).toISOString().slice(0,10)!==week) return json({error:"Use a Monday date"},400);
    if (input.scheduled===true) {
      const hour=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Brussels",hour:"2-digit",hourCycle:"h23"}).format();
      if (hour!=="18") return json({skipped:"Outside the scheduled Brussels hour"});
    }
    const {edition,sources}=await collectWeek(week);
    await database("tsu_watch_runs",{method:"POST",body:JSON.stringify({week,count:edition.items.length,sources})});
    if (!edition.items.length) return json({status:"empty",week,sources});
    await database("tsu_watch_drafts?on_conflict=week",{method:"POST",
      headers:{Prefer:"resolution=merge-duplicates"},body:JSON.stringify({week,contents:edition,collected_at:new Date().toISOString()})});
    return json({status:"ready",week,count:edition.items.length,sources});
  } catch(error) {
    console.error("TSŪ watch",error instanceof Error ? error.message : "unknown");
    return json({error:"Watch service unavailable"},502);
  }
});
