# Cook & Bake Academy

[![HTML5](https://img.shields.io/badge/HTML5-static%20site-E34F26?logo=html5&logoColor=white)](dist/index.html)
[![CSS3](https://img.shields.io/badge/CSS3-responsive-1572B6?logo=css3&logoColor=white)](dist/css/styles.css)
[![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=black)](dist/js/app.js)
[![Deploy to GitHub Pages](https://github.com/alfredang/cnbacademy/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/alfredang/cnbacademy/actions/workflows/deploy-pages.yml)

**Live site:** [alfredang.github.io/cnbacademy](https://alfredang.github.io/cnbacademy/)

## Overview

Cook & Bake Academy is a responsive catalogue for proposed hands-on cooking and baking classes in Singapore. It presents 20 courses across Bakery and Cooking, with schedules, teaching time, campuses, and total fees. The course details and fees are illustrative catalogue data, not verified sales or a live booking system.

Visitors can filter by category, search the catalogue, and use the on-page course finder to match a topic to courses. The course finder uses local keyword matching; it does not call an AI service or collect visitor details.

## Architecture

```text
.
├── .agents/commands/publish-to-github.md  # Project publishing runbook
├── .agents/skills/publish-to-github/       # Codex skill entry point
├── .github/workflows/deploy-pages.yml      # GitHub Pages deployment
├── .openai/hosting.json                    # Separate Sites configuration
├── dist/
│   ├── index.html                          # Page structure and content
│   ├── css/styles.css                      # Brand styles and responsive layout
│   ├── js/app.js                            # Catalogue rendering and interactions
│   └── data/courses.json                   # Single source for course fees and details
└── README.md
```

The browser loads `data/courses.json` with `fetch()`. `app.js` renders the cards, filters and search results from that data, and calculates teaching hours from each course's schedule and number of weeks. No course fee is hard-coded in the HTML or JavaScript.

## Run locally

**Requirements:** Python 3 and a modern browser. There is no package installation or build step.

1. Clone the repository and enter it:

   ```bash
   git clone https://github.com/alfredang/cnbacademy.git
   cd cnbacademy
   ```

2. Start a local HTTP server:

   ```bash
   python -m http.server 8080 --directory dist
   ```

3. Open [http://localhost:8080](http://localhost:8080).

Opening `dist/index.html` directly with `file://` will prevent the browser from fetching the JSON catalogue. Food photos load from Unsplash and require an internet connection.

## Publishing

Pushes to `main` run the [GitHub Pages workflow](.github/workflows/deploy-pages.yml). It uploads only `dist/` and publishes the artifact to the `github-pages` environment. The repository's project command at [.agents/commands/publish-to-github.md](.agents/commands/publish-to-github.md) describes the documentation, secret scan, metadata, push, and verification steps for future releases.

## Security and data

The site is static and has no login, payment handling, visitor data storage, or API keys. Before publishing, scan the proposed files and Git history for secrets, review the exact staged paths, and verify the deployed artifact. Do not put credentials, real customer data, or answer keys in `dist/`.
