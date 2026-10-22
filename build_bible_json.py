#!/usr/bin/env python3
"""
build_bible_json.py
Gabungin 4 sumber terbuka jadi satu JSON Alkitab dengan skema:
  { "books": [...], "verses": { BOOKID: { "1": [ {verse,id,en,orig,trans}, ... ] } } }

Sumber (semua lo download sendiri, taruh di folder lokal):
  --id-json   JSON terjemahan Indonesia (mis. TL 1912, public domain)
  --en-json   JSON terjemahan Inggris (mis. WEB / KJV, public domain)
              Keduanya format: {"books":[{"name":..,"chapters":[{"chapter":1,
              "verses":[{"verse":1,"text":".."}]}]}]}  (format scrollmapper/bible_databases)
              Urutan kitab harus kanonik 66 kitab (Kejadian ... Wahyu).
  --hebrew-dir  folder OSHB / MorphHB (OSIS XML per kitab: Gen.xml, Exod.xml, ...)
  --greek-dir   folder MorphGNT SBLGNT (61-Mt-morphgnt.txt ... 87-Re-morphgnt.txt)

Pakai:
  python build_bible_json.py --id-json TL.json --en-json WEB.json \
      --hebrew-dir ./wlc --greek-dir ./morphgnt-sblgnt \
      --id-label "Indonesia (TL 1912)" --en-label "English (WEB)"   # hasil: data/bible_db.json
  Tambah --split ./out_dir kalau mau dipecah per kitab (GEN.json, JOHN.json, ...).

Catatan lisensi: OSHB = CC BY 4.0, MorphGNT SBLGNT = CC BY-SA 3.0 -> cantumin atribusi di aplikasi.
"""
import argparse, json, os, re, sys, unicodedata
import xml.etree.ElementTree as ET

# (id, nama Indonesia, testament, jumlah pasal, kode OSIS OSHB / nomor+kode MorphGNT)
BOOKS = [
 ("GEN","Kejadian","OT",50,"Gen"),("EXO","Keluaran","OT",40,"Exod"),("LEV","Imamat","OT",27,"Lev"),
 ("NUM","Bilangan","OT",36,"Num"),("DEU","Ulangan","OT",34,"Deut"),("JOSH","Yosua","OT",24,"Josh"),
 ("JUDG","Hakim-hakim","OT",21,"Judg"),("RUTH","Rut","OT",4,"Ruth"),("1SAM","1 Samuel","OT",31,"1Sam"),
 ("2SAM","2 Samuel","OT",24,"2Sam"),("1KINGS","1 Raja-raja","OT",22,"1Kgs"),("2KINGS","2 Raja-raja","OT",25,"2Kgs"),
 ("1CHRON","1 Tawarikh","OT",29,"1Chr"),("2CHRON","2 Tawarikh","OT",36,"2Chr"),("EZRA","Ezra","OT",10,"Ezra"),
 ("NEH","Nehemia","OT",13,"Neh"),("EST","Ester","OT",10,"Esth"),("JOB","Ayub","OT",42,"Job"),
 ("PSALM","Mazmur","OT",150,"Ps"),("PROV","Amsal","OT",31,"Prov"),("ECCL","Pengkhotbah","OT",12,"Eccl"),
 ("SONG","Kidung Agung","OT",8,"Song"),("ISA","Yesaya","OT",66,"Isa"),("JER","Yeremia","OT",52,"Jer"),
 ("LAM","Ratapan","OT",5,"Lam"),("EZEK","Yehezkiel","OT",48,"Ezek"),("DAN","Daniel","OT",12,"Dan"),
 ("HOS","Hosea","OT",14,"Hos"),("JOEL","Yoel","OT",3,"Joel"),("AMOS","Amos","OT",9,"Amos"),
 ("OBAD","Obaja","OT",1,"Obad"),("JONAH","Yunus","OT",4,"Jonah"),("MIC","Mikha","OT",7,"Mic"),
 ("NAH","Nahum","OT",3,"Nah"),("HAB","Habakuk","OT",3,"Hab"),("ZEPH","Zefanya","OT",3,"Zeph"),
 ("HAG","Hagai","OT",2,"Hag"),("ZECH","Zakharia","OT",14,"Zech"),("MAL","Maleakhi","OT",4,"Mal"),
 ("MATT","Matius","NT",28,"Mt"),("MARK","Markus","NT",16,"Mk"),("LUKE","Lukas","NT",24,"Lk"),
 ("JOHN","Yohanes","NT",21,"Jn"),("ACTS","Kisah Para Rasul","NT",28,"Ac"),("ROM","Roma","NT",16,"Ro"),
 ("1COR","1 Korintus","NT",16,"1Co"),("2COR","2 Korintus","NT",13,"2Co"),("GAL","Galasia","NT",6,"Ga"),
 ("EPH","Efesus","NT",6,"Eph"),("PHIL","Filipi","NT",4,"Php"),("COL","Kolose","NT",4,"Col"),
 ("1THESS","1 Tesalonika","NT",5,"1Th"),("2THESS","2 Tesalonika","NT",3,"2Th"),("1TIM","1 Timotius","NT",6,"1Ti"),
 ("2TIM","2 Timotius","NT",4,"2Ti"),("TITUS","Titus","NT",3,"Tit"),("PHILEM","Filemon","NT",1,"Phm"),
 ("HEB","Ibrani","NT",13,"Heb"),("JAMES","Yakobus","NT",5,"Jas"),("1PET","1 Petrus","NT",5,"1Pe"),
 ("2PET","2 Petrus","NT",3,"2Pe"),("1JOHN","1 Yohanes","NT",5,"1Jn"),("2JOHN","2 Yohanes","NT",1,"2Jn"),
 ("3JOHN","3 Yohanes","NT",1,"3Jn"),("JUDE","Yudas","NT",1,"Jud"),("REV","Wahyu","NT",22,"Re"),
]
assert len(BOOKS) == 66

# ---------------------------------------------------------------- loader terjemahan
def load_translation(path):
    """-> { book_index: { chapter: { verse: text } } } (urutan kitab = kanonik)"""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    books = data["books"] if isinstance(data, dict) else data
    if len(books) != 66:
        sys.exit(f"[ERROR] {path}: ketemu {len(books)} kitab, harusnya 66 (urutan kanonik).")
    out = {}
    for bi, b in enumerate(books):
        chs = {}
        for c in b["chapters"]:
            chs[int(c["chapter"])] = {int(v["verse"]): v["text"].strip() for v in c["verses"]}
        out[bi] = chs
    return out

# ---------------------------------------------------------------- loader Ibrani (OSHB)
def local(tag): return tag.split("}")[-1]

def load_hebrew_book(dirpath, osis):
    path = os.path.join(dirpath, f"{osis}.xml")
    if not os.path.exists(path):
        return None
    res = {}
    for el in ET.parse(path).getroot().iter():
        if local(el.tag) != "verse" or not el.get("osisID"):
            continue
        _, ch, vs = el.get("osisID").split(".")[:3]
        parts, prev_maqqef = [], True
        for sub in el.iter():
            t = local(sub.tag)
            if t == "w":
                w = (sub.text or "").replace("/", "")
                if parts and not prev_maqqef:
                    parts.append(" ")
                parts.append(w); prev_maqqef = False
            elif t == "seg" and sub.text:
                parts.append(sub.text)
                prev_maqqef = (sub.text == "\u05BE")
        res.setdefault(int(ch), {})[int(vs)] = "".join(parts).strip()
    return res

# ---------------------------------------------------------------- loader Yunani (MorphGNT)
def load_greek_book(dirpath, nt_index, code):
    num = 61 + nt_index
    path = os.path.join(dirpath, f"{num}-{code}-morphgnt.txt")
    if not os.path.exists(path):
        return None
    res = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            p = line.split()
            if len(p) < 4: continue
            ref = p[0]                       # BBCCVV
            ch, vs = int(ref[2:4]), int(ref[4:6])
            res.setdefault(ch, {}).setdefault(vs, []).append(p[3])
    return {c: {v: " ".join(ws) for v, ws in vv.items()} for c, vv in res.items()}

# ---------------------------------------------------------------- transliterasi (sederhana)
HEB_CONS = {"א":"'","ב":"b","ג":"g","ד":"d","ה":"h","ו":"v","ז":"z","ח":"ch","ט":"t","י":"y","כ":"k","ך":"k",
            "ל":"l","מ":"m","ם":"m","נ":"n","ן":"n","ס":"s","ע":"'","פ":"p","ף":"p","צ":"ts","ץ":"ts",
            "ק":"q","ר":"r","ש":"sh","ת":"t"}
HEB_VOW = {"\u05B0":"e","\u05B1":"e","\u05B2":"a","\u05B3":"o","\u05B4":"i","\u05B5":"e","\u05B6":"e",
           "\u05B7":"a","\u05B8":"a","\u05B9":"o","\u05BA":"o","\u05BB":"u"}
HEB_CLUSTER = re.compile(r"([\u05D0-\u05EA])([\u0591-\u05C7]*)")

def translit_hebrew(text):
    out, pos = [], 0
    for m in HEB_CLUSTER.finditer(text):
        out.append({"\u05BE":"-","\u05C3":"."}.get(text[pos:m.start()].strip(), " " if text[pos:m.start()].strip()=="" and pos else "")
                   if text[pos:m.start()] else "")
        pos = m.end()
        c, marks = m.group(1), m.group(2)
        vowels = "".join(HEB_VOW.get(x, "") for x in marks)
        if c == "ו":
            if "\u05B9" in marks: out.append("o"); continue
            if "\u05BC" in marks and not vowels: out.append("u"); continue
        if c == "ש" and "\u05C2" in marks: out.append("s" + vowels); continue
        out.append(HEB_CONS[c] + vowels)
        if "\u05C3" in marks: out.append(".")
    tail = text[pos:]
    if "\u05C3" in tail: out.append(".")
    s = re.sub(r"\s+", " ", "".join(out)).strip()
    return s[:1].upper() + s[1:] if s else s

GRK = {"α":"a","β":"b","γ":"g","δ":"d","ε":"e","ζ":"z","η":"ē","θ":"th","ι":"i","κ":"k","λ":"l","μ":"m",
       "ν":"n","ξ":"x","ο":"o","π":"p","ρ":"r","σ":"s","ς":"s","τ":"t","υ":"y","φ":"ph","χ":"ch","ψ":"ps","ω":"ō"}

def translit_greek_word(w):
    d = unicodedata.normalize("NFD", w.lower())
    rough = "\u0314" in d
    base = "".join(ch for ch in d if unicodedata.category(ch) != "Mn")
    base = (base.replace("γγ","ng").replace("γκ","nk").replace("γξ","nx").replace("γχ","nch")
                .replace("ου","ou").replace("αυ","au").replace("ευ","eu"))
    out = "".join(GRK.get(ch, ch) for ch in base)
    if rough:
        out = ("rh" + out[1:]) if base.startswith("ρ") else "h" + out
    return out

def translit_greek(text):
    words = [translit_greek_word(re.sub(r"[^\w]", "", w)) if re.sub(r"[^\w]", "", w) else w for w in text.split()]
    s = " ".join(x for x in words if x)
    return s[:1].upper() + s[1:] if s else s

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id-json", required=True)
    ap.add_argument("--en-json", required=True)
    ap.add_argument("--hebrew-dir", required=True)
    ap.add_argument("--greek-dir", required=True)
    ap.add_argument("--out", default="data/bible_db.json")
    ap.add_argument("--id-label", default="Indonesia", help="label terjemahan Indonesia, mis. 'Indonesia (TL 1912)'")
    ap.add_argument("--en-label", default="English", help="label terjemahan Inggris, mis. 'English (WEB)'")
    ap.add_argument("--split", help="folder output untuk file per kitab")
    a = ap.parse_args()

    idt, ent = load_translation(a.id_json), load_translation(a.en_json)
    books_out, verses_out, warnings = [], {}, []

    for bi, (bid, name, testament, nch, code) in enumerate(BOOKS):
        books_out.append({"id": bid, "name": name, "testament": testament, "totalChapters": nch})
        if testament == "OT":
            orig = load_hebrew_book(a.hebrew_dir, code); tr = translit_hebrew
        else:
            orig = load_greek_book(a.greek_dir, bi - 39, code); tr = translit_greek
        if orig is None:
            warnings.append(f"{bid}: file teks asli tidak ketemu ({code})"); orig = {}

        found = set(idt[bi]) | set(ent[bi]) | set(orig)
        if max(found, default=0) != nch:
            warnings.append(f"{bid}: jumlah pasal data={max(found, default=0)} vs skema={nch}")
        verses_out[bid] = {}
        for ch in range(1, nch + 1):
            nums = sorted(set(idt[bi].get(ch, {})) | set(ent[bi].get(ch, {})) | set(orig.get(ch, {})))
            rows = []
            for v in nums:
                o = orig.get(ch, {}).get(v, "")
                row = {"verse": v,
                       "id": idt[bi].get(ch, {}).get(v, ""),
                       "en": ent[bi].get(ch, {}).get(v, ""),
                       "orig": o,
                       "trans": tr(o) if o else ""}
                missing = [k for k in ("id", "en", "orig") if not row[k]]
                if missing:
                    warnings.append(f"{bid} {ch}:{v} kosong -> {','.join(missing)}")
                rows.append(row)
            verses_out[bid][str(ch)] = rows

    result = {
        "meta": {
            "idLabel": a.id_label,
            "enLabel": a.en_label,
            "sources": f"Indonesia: {a.id_label}. English: {a.en_label}. Ibrani: Open Scriptures Hebrew Bible (CC BY 4.0). "
                       "Yunani: MorphGNT SBLGNT (CC BY-SA 3.0). Transliterasi dibuat otomatis (romanisasi sederhana).",
        },
        "books": books_out,
        "verses": verses_out,
    }
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
    if a.split:
        os.makedirs(a.split, exist_ok=True)
        for b in books_out:
            with open(os.path.join(a.split, f"{b['id']}.json"), "w", encoding="utf-8") as f:
                json.dump({"book": b, "chapters": verses_out[b["id"]]}, f, ensure_ascii=False)
    total = sum(len(v) for b in verses_out.values() for v in b.values())
    print(f"Selesai: {total} ayat -> {a.out}")
    if warnings:
        with open("warnings.log", "w", encoding="utf-8") as f: f.write("\n".join(warnings))
        print(f"{len(warnings)} peringatan, lihat warnings.log (biasanya beda penomoran ayat antar versi).")

if __name__ == "__main__":
    main()
