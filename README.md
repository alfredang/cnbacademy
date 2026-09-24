# Cook & Bake Academy

Static HTML, CSS and JavaScript site. The catalogue is loaded from `dist/data/courses.json`.

Run locally from this folder:

```powershell
python -m http.server 8080 --directory dist
```

Open http://localhost:8080. The JSON catalogue requires an HTTP server; opening `index.html` directly will not load the cards.
