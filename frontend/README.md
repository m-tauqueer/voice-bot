# frontend

Browser app. Copied from the component library at `Desktop/component-library`. Design notes: [`COMPONENT_LIBRARY.md`](COMPONENT_LIBRARY.md).

```bash
npm run dev:frontend
```

- http://localhost:5188/ and `/components` — component gallery (default)
- http://localhost:5188/dashboard — sample dashboard shell

Stylesheet import order in `src/main.tsx` is load-bearing. Do not reorder it. Do not `import` CSS from components.
