# Component library

The Metacognition gallery and unused primitives do **not** live in this repo.

**Source of truth:** `Desktop/component-library` (or whichever copy Tauqueer keeps on disk). Open that project when you need a primitive, a chart, or a shell piece. Copy only the file the product is about to use into `frontend/src`. Do not copy the gallery, and do not add this library as an npm dependency.

What stays here is what the voice bot actually renders: sign-in, the app shell, chat, voice, and the dashboard tabs. Styles still load from `frontend/src/main.tsx` in the existing order so tokens keep working.
