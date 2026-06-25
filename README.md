# Clean BG Remover

A simple GitHub Pages background remover. It runs in the browser, removes the image background with `@imgly/background-removal`, previews the transparent result, and exports a PNG.

## Files

```txt
bg-remover-tool/
├── index.html
├── .nojekyll
├── css/
│   └── style.css
└── js/
    └── app.js
```

## How to deploy on GitHub Pages

1. Create a new GitHub repository, for example `bg-remover-tool`.
2. Upload `index.html`, `.nojekyll`, the `css` folder, and the `js` folder.
3. Go to repository `Settings`.
4. Open `Pages`.
5. Under `Build and deployment`, choose `Deploy from a branch`.
6. Select `main` and `/root`.
7. Save.
8. Your site will publish at a URL like:

```txt
https://YOUR-USERNAME.github.io/bg-remover-tool/
```

## Notes

- The first background removal can take longer because the AI model files download and cache in the browser.
- The tool exports transparent PNG files.
- This version uses the public CDN package. For serious production use, check the package license and consider hosting the model assets yourself.
