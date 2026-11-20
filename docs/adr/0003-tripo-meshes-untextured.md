# Tripo props become palette sections; Tripo characters keep a small texture

When the Team wants more detailed 3D models, we generate them with Tripo (`tools/tripo_model.py`), in two kinds.

**Props** (houses, chimneys, scenery): `smart_low_poly`, painted, then baked on our machine into one flat-shaded section per Style Lock palette colour, with no texture or UVs. They match the hand-built primitives, stay tiny on GitHub Pages, and can be recoloured in-game. Tripo's own `generate_parts` was the alternative for separable parts, but it can't be combined with `smart_low_poly`. The painted original is kept git-ignored in `assets/models/_source/` so sections can be re-baked with a new palette for free.

**Characters** (anything that animates): the palette bake made the rehearsal hero look far worse than a model made in Tripo's web app, because it erased the face and details, and the 2k-face low-poly cap made it blocky. Characters therefore keep Tripo's texture, capped at 1024 px (we shrink it after download), use up to 6k faces without `smart_low_poly`, and are auto-rigged with preset animations through the API. The trade-off is that characters look smoother and more detailed than the town around them.

The API key lives in the `TRIPO_API_KEY` environment variable on the session machine, never in the repo.
