# Static Art Portfolio

A no-build multilingual art portfolio for GitHub Pages.

## Edit content

- Add paintings in `assets/artworks.json`.
- Add or change site text, contact links, SEO text, and the GitHub Pages URL in `assets/site.json`.
- Replace sample images under `assets/artworks/<artwork-id>/`.
- Replace `assets/social-preview.jpg` with the image you want WhatsApp and social apps to show.

## Local admin editor

GitHub Pages is static, so it cannot save uploads or edit JSON. To edit locally:

```bash
node local-server.js
```

Then open:

```text
http://127.0.0.1:4173/admin.html
```

The admin editor writes images into `assets/artworks/<artwork-id>/` and updates `assets/artworks.json`. It is not linked from the public site, and it disables itself when opened from a non-local host.

## Publish checklist

1. Replace `https://example.github.io/VOM/` in `index.html`, `assets/site.json`, `robots.txt`, and `sitemap.xml` with the real GitHub Pages URL.
2. Replace `artist@example.com`, the WhatsApp number, and Instagram URL in `assets/site.json`.
3. Commit and push to GitHub.
4. Enable GitHub Pages for the repository root.
