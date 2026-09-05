#!/usr/bin/env python3
"""Archive primary sources for the PBUI-WIRING foundations section.
Downloads only; no install or execution of downloaded material.
Existing successful files are preserved; manifest includes SHA-256 and UTC time.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
from datetime import datetime, timezone
import hashlib, json, subprocess
OUT=Path(__file__).resolve().parent.parent/"sources"/"foundations"
OUT.mkdir(parents=True,exist_ok=True)
SOURCES=[
  {
    "id": "F01",
    "title": "Orthogonal Connector Routing",
    "authors": "Wybrow, Marriott, Stuckey",
    "date": 2009,
    "url": "https://users.monash.edu/~mwybrow/papers/wybrow-gd-2009.pdf",
    "file": "01-orthogonal-connector-routing.pdf"
  },
  {
    "id": "F02",
    "title": "Incremental Connector Routing",
    "authors": "Wybrow, Marriott, Stuckey",
    "date": "GD 2005; proceedings 2006",
    "url": "https://users.monash.edu/~mwybrow/papers/wybrow-gd-2005.pdf",
    "file": "02-incremental-connector-routing.pdf"
  },
  {
    "id": "F03",
    "title": "The Cassowary Linear Arithmetic Constraint Solving Algorithm",
    "authors": "Badros, Borning, Stuckey",
    "date": "author-hosted manuscript",
    "url": "https://badros.com/greg/papers/cassowary-tochi.pdf",
    "file": "03-cassowary.pdf"
  },
  {
    "id": "F04",
    "title": "Shortest Paths II: Dijkstra, MIT 6.006 Lecture 16",
    "authors": "MIT OpenCourseWare",
    "date": 2011,
    "url": "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/6277a1f06100c26a7ff21031af6757b5_MIT6_006F11_lec16.pdf",
    "file": "04-mit-dijkstra.pdf"
  },
  {
    "id": "F05",
    "title": "Build Systems a la Carte",
    "authors": "Mokhov, Mitchell, Peyton Jones",
    "date": 2018,
    "url": "https://www.microsoft.com/en-us/research/wp-content/uploads/2018/03/build-systems.pdf",
    "file": "05-build-systems.pdf"
  },
  {
    "id": "F06",
    "title": "Specifying Systems",
    "authors": "Leslie Lamport",
    "date": 2002,
    "url": "https://lamport.azurewebsites.net/tla/book-02-08-08.pdf",
    "file": "06-specifying-systems.pdf"
  },
  {
    "id": "F07",
    "title": "Fast Robust Predicates for Computational Geometry",
    "authors": "Jonathan Richard Shewchuk",
    "date": "author resource page",
    "url": "https://www.cs.cmu.edu/~quake/robust.html",
    "file": "07-robust-predicates.html"
  },
  {
    "id": "F08",
    "title": "CSS Overflow Module Level 3",
    "authors": "W3C CSS Working Group",
    "date": "snapshot at retrieval",
    "url": "https://www.w3.org/TR/css-overflow-3/",
    "file": "08-css-overflow.html"
  },
  {
    "id": "F09",
    "title": "Resize Observer",
    "authors": "W3C",
    "date": "snapshot at retrieval",
    "url": "https://www.w3.org/TR/resize-observer/",
    "file": "09-resize-observer.html"
  },
  {
    "id": "F10",
    "title": "useSyncExternalStore",
    "authors": "React documentation",
    "date": "snapshot at retrieval",
    "url": "https://react.dev/reference/react/useSyncExternalStore",
    "file": "10-react-external-store.html"
  },
  {
    "id": "F11",
    "title": "Understanding SC 2.5.7: Dragging Movements",
    "authors": "W3C WAI",
    "date": "snapshot at retrieval",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html",
    "file": "11-dragging-movements.html"
  },
  {
    "id": "F12",
    "title": "Understanding SC 2.5.8: Target Size (Minimum)",
    "authors": "W3C WAI",
    "date": "snapshot at retrieval",
    "url": "https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html",
    "file": "12-target-size.html"
  },
  {
    "id": "F13",
    "title": "libavoid Router API",
    "authors": "Adaptagrams project",
    "date": "generated API documentation snapshot",
    "url": "https://www.adaptagrams.org/documentation/classAvoid_1_1Router.html",
    "file": "13-libavoid-router.html"
  }
]
def fetch(source):
    record=dict(source)
    target=OUT/source["file"]
    try:
        with urlopen(Request(source["url"],headers={"User-Agent":"PBUI-Wiring-Review/1.0"}),timeout=35) as response:
            data=response.read()
            record.update(final_url=response.url,content_type=response.headers.get("Content-Type"),retrieved_at=datetime.now(timezone.utc).isoformat())
        if source["file"].endswith(".pdf") and not data.startswith(b"%PDF"):
            raise ValueError("Expected PDF signature")
        if target.exists() and target.read_bytes()!=data:
            raise ValueError("Existing source differs; preserve original instead of overwriting")
        target.write_bytes(data)
        record.update(status="downloaded",bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
        if target.suffix==".pdf":
            subprocess.run(["pdftotext","-layout",str(target),str(target.with_suffix(".txt"))],check=True)
    except Exception as error:
        record.update(status="failed",error=str(error))
    return record
with ThreadPoolExecutor(max_workers=4) as pool:
    records=list(pool.map(fetch,SOURCES))
(OUT/"manifest.json").write_text(json.dumps(records,indent=2)+"\n")
for r in records:print(r["id"],r["status"],r.get("bytes",r.get("error")))

