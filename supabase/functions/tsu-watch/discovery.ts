import { load } from "cheerio";
import type { Release } from "./collect.ts";

const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const neat = (value: string) => value.replace(/\s+/g," ").trim();
const reference = (value: string,origin: string,path: RegExp) => {
  try {
    const url=new URL(value,origin);
    return url.origin===origin && path.test(url.pathname) ? url.href : "";
  } catch { return ""; }
};

export function icotakuCards(markup: string): Release[] {
  const $=load(markup);
  $("script,style").remove();
  const origin="https://manga.icotaku.com";
  const items: Release[]=[];
  let date="";
  $("tr").each((_,row)=>{
    const cells=$(row).children("td,th");
    const marker=neat(cells.first().text()).toLowerCase().match(/^(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) (\d{1,2}) ([\p{L}]+) (\d{4})$/u);
    if (marker) {
      const month=months.indexOf(marker[2])+1;
      date=month ? [marker[3],String(month).padStart(2,"0"),marker[1].padStart(2,"0")].join("-") : "";
      return;
    }
    if (!date || cells.length<2) return;
    const first=cells.first();
    const anchor=first.find("a[href]").filter((_,link)=>neat($(link).text()).length>0).first();
    const name=neat(anchor.text());
    const volume=neat(first.text()).match(/\b(?:vol(?:ume)?\.?\s*\d+|one[\s-]?shot)\b/i)?.[0] ?? "";
    const source=reference(anchor.attr("href")??"",origin,/^\/manga\//);
    const publisher=neat(cells.eq(1).text()).slice(0,70);
    if (name && source && publisher) items.push({kind:"manga",title:neat(name+" "+volume).slice(0,150),date,source,
      provider:"Icotaku",publisher,noteFr:"Parution francophone référencée par Icotaku.",
      noteEn:"French-language release listed by Icotaku."});
  });
  return items;
}

export type News = {title:string; date:string; source:string; provider:string};
export function newsCards(markup:string): News[] {
  const $=load(markup,{xml:true});
  return $("item").toArray().flatMap(node=>{
    const item=$(node);
    const title=neat(item.children("title").text());
    const time=Date.parse(item.children("pubDate").text());
    const source=reference(item.children("link").text(),"https://www.manga-news.com",/^\/index\.php\/actus\//);
    if (!title || !Number.isFinite(time) || !source) return [];
    return [{title: title.slice(0,230),date:new Date(time).toISOString().slice(0,10),source,provider:"Manga-news"}];
  });
}

export const topicKey=(title:string)=>title.normalize("NFKD").toLowerCase()
  .replace(/\b(?:vol(?:ume)?[.]?|tome|t)\s*0*(\d+)/g," tome $1 ").replace(/[^\p{L}\p{N}]/gu,"");
export const seriesKey=(title:string)=>topicKey(title.replace(/\s*(?:[·—–]|tome|vol[.]?|\bt(?=\d))\s*\d+.*$/i,""));
