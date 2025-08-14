# Size Order Allocator

A React application for automatically distributing product orders across sizes (and optionally two product variants) based on historical sales data and current stock levels. Supports saving/loading presets, CSV/XLSX export, and single- or dual-variant modes.


## Features
- Automatic allocation based on sales proportions & stock
- Single or dual variants (Boat neck / V-neck)
- Proportions computed directly from entered sales
- CSV/XLSX export
- Save & load presets (localStorage)
- Responsive UI
- Dynamic page title (mode-aware)

## Deployment (Vercel)
1. Push this repository to GitHub.
2. On https://vercel.com → **New Project**.
3. Import the GitHub repo.
4. Framework preset: **Vite** (or **Other** if not detected).
5. Build command: `npm run build`
6. Output directory: `dist`
7. Deploy.



