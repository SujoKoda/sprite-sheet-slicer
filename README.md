# Sprite Sheet Slicer

A browser tool that cuts a sprite sheet into individual frames and exports them as a ZIP. It runs entirely in your browser, with no install, no backend and no uploads.

## Why I built this

I edit sprite sheets for a Pokémon fan game project, and I usually batch-process and slice them with Python (PIL, NumPy and SciPy). I rebuilt that workflow as a web tool to practice the Canvas and File APIs, and because a browser version is faster for quick one-off slicing than writing a script each time.

## Features

- Drag and drop or click to load a PNG, JPG, GIF or WebP sprite sheet
- Slice by rows and columns, or by a fixed frame width and height
- Margin and spacing controls for sheets that have padding between frames
- Live grid overlay on the sheet preview, with the selected frame highlighted
- Click a frame on the sheet or in the frame list to inspect it enlarged, or use the left and right arrow keys to step through frames
- Download a single frame, or export every frame as a ZIP of PNGs
- Optional `frames.json` in the ZIP with the position and size of every frame, for use in game engines
- A built-in sample sheet, so you can try the tool without an image

## How to use it

1. Load a sprite sheet, or click **Try a sample sheet**.
2. Choose **Rows and columns** or **Frame size**, then adjust the numbers until the teal grid lines up with your frames. Add margin or spacing if the sheet has padding.
3. Click any frame to inspect it.
4. Click **Export all as ZIP**.

## Tech stack

- Vanilla JavaScript with the Canvas API, the File API and drag-and-drop events
- [JSZip](https://stuk.github.io/jszip/) (loaded from a CDN) to build the ZIP in the browser
- Plain HTML and CSS, with no framework and no build step

## Run it locally

There is nothing to build. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

The ZIP export needs an internet connection the first time, because JSZip loads from a CDN.

## Deploy with GitHub Pages

1. Push this folder to a GitHub repository.
2. Open the repository's **Settings**, then **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, and save.
4. After a minute, the site is live at `https://<your-username>.github.io/<repository-name>/`.

## How the slicing works

- **Rows and columns:** the frame size is `(sheet size - 2 x margin - spacing x (count - 1)) / count`, rounded down.
- **Frame size:** the number of frames that fit is `(sheet size - 2 x margin + spacing) / (frame size + spacing)`, rounded down.
- Frames are numbered left to right, top to bottom, and exported as `name_001.png`, `name_002.png` and so on.

## Ideas for next steps

- Read frame timing from animated GIFs
- Onion-skin preview to compare neighboring frames
- Trim transparent padding from each frame before export

## License

MIT. See [LICENSE](LICENSE).
