import { useState } from 'react'
import type { EducationArticle } from '../../lib/educationCms'
import './educationNewsTicker.css'
export function EducationNewsTicker({items,base}:{items:EducationArticle[];base:string}){
 const [paused,setPaused]=useState(false)
 if(!items.length)return <span className="text-white/70">News and updates will appear here.</span>
 const group=(duplicate:boolean)=><div className={`education-news-group ${duplicate?'education-news-duplicate':''}`} aria-hidden={duplicate||undefined}>{items.map(item=><a key={item.id} href={`${base}/school/news#news-${encodeURIComponent(item.id)}`} tabIndex={duplicate?-1:undefined} className="education-news-link hover:underline">{item.date&&<time dateTime={item.date}>{item.date} · </time>}{item.title}</a>)}</div>
 return <div className="flex min-w-0 flex-1 items-center gap-2"><div className="education-news-window" aria-label="Latest news"><div className={`education-news-track ${paused?'education-news-paused':''}`}>{group(false)}{group(true)}</div></div><button type="button" className="shrink-0 rounded border border-white/30 px-2 py-1 text-[11px] text-white/90 hover:bg-white/10" onClick={()=>setPaused(v=>!v)} aria-pressed={paused} aria-label={paused?'Resume scrolling news':'Pause scrolling news'}>{paused?'Play':'Pause'}</button></div>
}
