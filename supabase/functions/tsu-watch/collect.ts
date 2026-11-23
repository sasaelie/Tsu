import { load } from "cheerio";

export type Release = { kind: "manga" | "anime"; title: string; date: string; source: string; noteFr?: string; noteEn?: string };
const day = 86400000;
const brussels = new Intl.DateTimeFormat("sv-SE",{ timeZone:"Europe/Brussels", year:"numeric", month:"2-digit", day:"2-digit" });
const dateISO = (d: Date) => d.toISOString().slice(0,10);
export function nextWeek(now = new Date()) {
  const local = new Date(brussels.format(now));
  return dateISO(new Date(+local + (7-((local.getUTCDay()+6)%7))*day));
}
export const endOfWeek = (week: string) => dateISO(new Date(+new Date(week)+6*day));
const neat = (value: string) => value.replace(/\s+/g," ").trim();
function dateFrom(value: string) {
  const iso = value.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  const local = value.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  return iso ?? (local ? [local[3],local[2],local[1]].join("-") : "");
}
const datePattern = /\b(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\b/g;

export function mangaCards(markup: string, origin: string, publisher: string) {
  const $ = load(markup);
  const items: Release[] = [];
  const prefix = publisher==="Pika" ? "/livre/" : "/manga/";
  $("a[href]").each((_,anchor)=>{
    const href = $(anchor).attr("href") ?? "";
    let url: URL;
    try { url=new URL(href,origin); } catch { return; }
    if (url.origin!==origin || !url.pathname.startsWith(prefix) ||
      /\/(?:planning-des-sorties|collection|series|a-paraitre)\b/.test(url.pathname)) return;
    let card = $(anchor);
    for (let depth=0; depth<4 && card.length; depth++,card=card.parent()) {
      const dateTags = card.find("time").toArray().map(el=>$(el).attr("datetime")??$(el).text());
      const raw = neat((card.html()??"").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," "));
      const dates = [...new Set([...dateTags,...(raw.match(datePattern)??[])].map(dateFrom).filter(Boolean))];
      if (dates.length>1 || raw.length>650) break;
      if (dates.length!==1) continue;
      const heading = card.find("h2,h3,h4,.title,[class*=title]").first();
      const label = neat(heading.text() || $(anchor).attr("aria-label") || $(anchor).attr("title") || $(anchor).text() || card.text());
      const title = neat(label.replace(/^(?:remove_red_eye_outlined\s*)?(?:(?:À paraître|Nouveauté)\s*)?(?:Pika|Glénat)?\s*(?:Shônen|Shōnen|Seinen|Shôjo|Josei|Masterpiece|Wavetoon)?\s*/i,"").replace(datePattern,""));
      if (title.length<3 || title.length>150 || !/\p{L}/u.test(title)) break;
      items.push({kind:"manga",title,date:dates[0],source:url.href,
        noteFr:"Parution indiquée par "+publisher+" pour l’édition francophone.",noteEn:"French-language publication listed by "+publisher+"."});
      break;
    }
  });
  return items;
}

export function mangaNewsCards(markup: string) {
  const $=load(markup);
  const origin="https://www.manga-news.com";
  const items: Release[]=[];
  $("tr").each((_,row)=>{
    const cells=$(row).children("td");
    if (cells.length<3) return;
    const date=dateFrom(cells.eq(0).text());
    const anchor=cells.eq(1).find("a[href]").first();
    const title=neat(anchor.text()).slice(0,150);
    const publisher=neat(cells.eq(2).text()).slice(0,70);
    if (!date || !title || !publisher || !anchor.attr("href")) return;
    const source=new URL(anchor.attr("href")!,origin);
    if (source.origin!==origin) return;
    items.push({kind:"manga",title,date,source:source.href,
      noteFr:"Édition francophone ("+publisher+"), selon le calendrier Manga-news.",
      noteEn:"French-language edition ("+publisher+"), according to the Manga-news calendar."});
  });
  return items;
}

async function request(url: string) {
  for (let attempt=0;attempt<2;attempt++) {
    try {
      const response=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(9500),
        headers:{"User-Agent":"TSU-Journal/1.0 (public release calendar)"}});
      if (response.ok) return response;
      if (response.status<500 && response.status!==429) throw new Error("HTTP "+response.status);
      if (attempt===1) throw new Error("HTTP "+response.status);
    } catch(error) {
      if (attempt===1 || (error instanceof Error && /^HTTP 4(?!29)/.test(error.message))) throw error;
    }
    await new Promise(resolve=>setTimeout(resolve,450));
  }
  throw new Error("Source indisponible");
}

async function animeDay(date: string): Promise<Release[]> {
  const result=await (await request("https://api.tvmaze.com/schedule?country=JP&date="+date)).json();
  if (!Array.isArray(result)) throw new Error("Calendrier anime invalide");
  return result.flatMap(episode=>{
    const show=episode?.show;
    if (!show?.genres?.includes("Anime") || typeof show.name!=="string" ||
        typeof show.url!=="string" || !show.url.startsWith("https://www.tvmaze.com/shows/")) return [];
    const suffix = typeof episode.number==="number" ? " · "+episode.number : "";
    return [{kind:"anime",title:neat(show.name+suffix).slice(0,150),date,source:show.url,
      noteFr:"Diffusion au Japon selon TVmaze. Disponibilité en Belgique à vérifier.",
      noteEn:"Japanese broadcast listed by TVmaze. Belgian availability is unverified."}];
  });
}

export function selectReleases(items: Release[],week: string) {
  const end=endOfWeek(week);
  const unique=new Map<string,Release>();
  for (const item of items) {
    if(item.date<week || item.date>end) continue;
    const key=[item.kind,item.title.normalize("NFKC").toLocaleLowerCase().replace(/\b(?:vol[.]?|tome|t)\s*0*(\d+)/gi," tome $1").replace(/[^\p{L}\p{N}]/gu,"")].join("|");
    if (!unique.has(key)) unique.set(key,item);
  }
  const sorted=[...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title));
  return [...sorted.filter(x=>x.kind==="manga").slice(0,5), ...sorted.filter(x=>x.kind==="anime").slice(0,5)];
}

export async function collectWeek(week: string) {
  const end=endOfWeek(week);
  const months=[...new Set([week.slice(0,7),end.slice(0,7)])];
  const inputs: {label:string; run:()=>Promise<Release[]>}[]=[];
  for (const month of months) {
    inputs.push({label:"Manga-news "+month,run:async()=>{
      const [year,number]=month.split("-");
      const response=await request("https://www.manga-news.com/index.php/planning?p_editor=&p_month="+number+"&p_year="+year+"&print=1");
      const items=mangaNewsCards(await response.text());
      if (!items.length) throw new Error("Aucune sortie datée reconnue");
      return items;
    }});
    for (const [publisher,origin,path] of [
      ["Pika","https://www.pika.fr","/planning-sorties/"],
      ["Glénat","https://www.glenat.com","/manga/planning-des-sorties/"]
    ]) {
      inputs.push({label:publisher+" "+month,run:async()=>{
        const response=await request(origin+path+month+"/");
        const content=await response.text();
        const items=mangaCards(content,origin,publisher);
        if (!items.length) throw new Error("Aucune fiche datée reconnue");
        return items;
      }});
    }
  }
  for (let i=0;i<7;i++) {
    const date=dateISO(new Date(+new Date(week)+i*day));
    inputs.push({label:"TVmaze JP "+date,run:()=>animeDay(date)});
  }
  const results=await Promise.allSettled(inputs.map(input=>input.run()));
  const items=selectReleases(results.flatMap(r=>r.status==="fulfilled"?r.value:[]),week);
  const sources=results.map((result,i)=>({name:inputs[i].label,ok:result.status==="fulfilled",
    count:result.status==="fulfilled"?result.value.length:0,
    ...(result.status==="rejected"?{error:result.reason instanceof Error?result.reason.message.slice(0,120):"Source indisponible"}:{})
  }));
  return {edition:{week,introFr:"Une sélection des parutions francophones et diffusions anime repérées pour la semaine.",
    introEn:"A selection of French-language releases and anime broadcasts listed for this week.",items},sources};
}
