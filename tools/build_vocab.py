import json, re, html, sys, os
sys.stdout.reconfigure(encoding="utf-8")

POS_MAP={"n":"n.","v":"v.","a":"adj.","ad":"adv.","an":"adj./n.","vn":"v./n.","d":"adv.","c":"conj.","p":"prep.","r":"pron.","q":"classifier","m":"num.","t":"time","f":"direction","i":"idiom","l":"fixed phrase","y":"particle","e":"interj.","o":"onom.","u":"aux.","b":"attrib.","z":"descriptive","nr":"proper n.","ns":"proper n.","nt":"proper n.","nz":"proper n.","nx":"proper n.","g":"morpheme","k":"suffix","h":"prefix","j":"abbrev.","s":"place","w":"symbol","vd":"v.","vg":"v.","dg":"adv.","ag":"adj.","tg":"time","ng":"n.","rg":"pron.","mg":"num."}

def clean_en(text, limit=95):
    text=re.sub(r"\s+"," ",text).strip()
    if len(text)>limit:
        cut=text[:limit]
        cut=cut[:cut.rfind(";")] if ";" in cut else cut[:cut.rfind(" ")]
        text=cut.rstrip(";,: ")+"…"
    return text

def short_defs(meanings, n=4):
    out=[]
    for m in meanings:
        m=re.sub(r"\s+"," ",m).strip()
        if not m: continue
        # drop variant notes and classifier chatter
        if m.lower().startswith(("variant of","old variant","used in","see ")): continue
        out.append(m)
    return out[:n]

def load_official(path):
    arr=json.load(open(path,encoding="utf-8")); out={}
    for e in arr:
        f=e["f"][0]
        defs=short_defs(f["m"])
        out[e["s"]]={
            "en":clean_en("; ".join(defs[:2])),
            "defs":defs,
            "py":f["i"]["y"],
            "trad":f["t"],
            "pos":[POS_MAP.get(x,x) for x in e.get("p",[])][:3],
            "freq":e.get("q") or 999999,
            "rad":e.get("r",""),
        }
    return out

h3=load_official("data-src/hsk3.min.json")
h4=load_official("data-src/hsk4.min.json")
h5=load_official("data-src/hsk5.min.json")
h6=load_official("data-src/hsk6.min.json")

course=json.load(open("data-src/course5.json",encoding="utf-8"))
lessons=[]; words={}; order=0
for r in course:
    raw=r["title"]
    m=re.match(r"([\u4e00-\u9fff“”‘’—…·：，、！？\s]+?)\s+([A-Za-z].*)$", raw)
    zh=html.unescape(m.group(1).strip()) if m else raw
    en=html.unescape(m.group(2).strip()) if m else ""
    items=[]
    for it in r["items"]:
        w=it["w"]
        if w not in words:
            order+=1
            off=h5.get(w)
            words[w]={
                "id":order,"w":w,"py":it["py"],"pos":it["pos"],"en":it["en"],
                "lesson":r["lesson"],"also":[],
                "official": bool(off),
                "official_py": off["py"] if off else "",
                "in_hsk4": w in h4, "in_hsk6": w in h6,
                "trad": off["trad"] if off else "",
                "rad": off["rad"] if off else "",
                "freq": off["freq"] if off else 999999,
                "defs": off["defs"] if off else [it["en"]],
            }
        else:
            if r["lesson"] not in words[w]["also"] and r["lesson"]!=words[w]["lesson"]:
                words[w]["also"].append(r["lesson"])
        items.append(w)
    lessons.append({"n":r["lesson"],"zh":zh,"en":en,"book":1 if r["lesson"]<=18 else 2,"items":items})

# polyphone / pinyin mismatch report
mismatch=[(w,d["py"],d["official_py"]) for w,d in words.items() if d["official"] and d["official_py"] and d["official_py"]!=d["py"]]
print("lesson count",len(lessons),"words",len(words),"pinyin mismatches",len(mismatch))
print("mismatch sample:",mismatch[:12])

# gap = official HSK5 words not in book words
gap=[]
for w,d in h5.items():
    if w in words: continue
    gap.append({"w":w,"py":d["py"],"pos":d["pos"][0] if d["pos"] else "","en":d["en"],"defs":d["defs"],"freq":d["freq"],"trad":d["trad"],"rad":d["rad"]})
gap.sort(key=lambda x:(x["freq"],x["w"]))
for i,g in enumerate(gap,1): g["id"]=i

# hsk4 list for diagnosis/review sorted by frequency
h4list=[{"w":w,**d} for w,d in h4.items()]
h4list.sort(key=lambda x:(x["freq"],x["w"]))

out={
 "meta":{"generated":"2026-02","source_textbook":"HSK Standard Course 5 (HSK 2.0)",
         "book_word_count":len(words),"gap_count":len(gap),"hsk4_count":len(h4list),
         "note":"Lesson lists mirror the textbook core vocabulary order; English glosses adapted from CC-CEDICT."},
 "lessons":lessons,
 "words":list(words.values()),
 "gap":gap,
 "hsk4":h4list,
}
json.dump(out,open("data-src/merged.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
print("gap",len(gap),"h4",len(h4list))
print("merged size",os.path.getsize("data-src/merged.json"))
