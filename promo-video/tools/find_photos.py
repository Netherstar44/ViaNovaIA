import requests, json, sys

S = requests.Session()
S.headers.update({"User-Agent": "ViaNovaPromo/1.0 (local production)"})
queries = sys.argv[1:] or ["Tatacoa desert", "Rivera Huila", "Cocora valley", "Neiva Huila"]
for q in queries:
    r = S.get(
        "https://commons.wikimedia.org/w/api.php",
        params={
            "action": "query",
            "generator": "search",
            "gsrsearch": q,
            "gsrnamespace": 6,
            "gsrlimit": 12,
            "prop": "imageinfo",
            "iiprop": "url|size|extmetadata",
            "iiurlwidth": 2400,
            "format": "json",
        },
        timeout=30,
    )
    d = r.json()
    print("==", q, r.status_code)
    for p in d.get("query", {}).get("pages", {}).values():
        ii = p["imageinfo"][0]
        em = ii.get("extmetadata", {})
        lic = em.get("LicenseShortName", {}).get("value", "?")
        artist = em.get("Artist", {}).get("value", "?")
        print(f"{p['title'][:80]:80s} {ii['width']}x{ii['height']} {lic}")
        print("   ", ii.get("thumburl"))
        print("   artist:", artist[:120].replace("\n", " "))
