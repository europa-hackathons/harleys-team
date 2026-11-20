# No build step: plain HTML/JS with three.js from a CDN

The game is plain HTML and JavaScript modules, with three.js loaded through an import map from a pinned CDN URL. There is no npm, bundler, or compile step. GitHub Pages serves the repo as-is, which minimises what can break during a live three-hour session. Don't "upgrade" this to Vite or similar without a reason that outweighs that.
