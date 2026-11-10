import requests, json, sys

S = requests.Session()
S.headers.update({"User-Agent": "ViaNovaPromo/1.0 (local production)"})
titles = sys.argv[1:]
for t in titles:
    r = S.get(
        "https://commons.wikimedia.org/w/api.php",
        params={
            "action": "query",
            "titles": t,
            "prop": "imageinfo",
            "iiprop": "url|size|extmetadata",
            "iiurlwidth": 2400,
            "format": "json",
        },
        timeout=30,
    )
    for p in r.json().get("query", {}).get("pages", {}).values():
        ii = p["imageinfo"][0]
        em = ii.get("extmetadata", {})
        print("==", p["title"], ii["width"], ii["height"])
        print("desc:", em.get("ImageDescription", {}).get("value", "")[:600])
        print("lic:", em.get("LicenseShortName", {}).get("value"))
        print("artist:", em.get("Artist", {}).get("value", "")[:200])
        print("url:", ii.get("thumburl"))
