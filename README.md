# Premium Email Scraper

A professional-grade email extraction tool with recursive scraping, Cloudflare email protection bypass, and a modern glassmorphic UI.

## Features
- **Recursive Scraping**: Crawls internal links on the same domain up to a depth of 2.
- **Bypass Protection**: Automatically decodes Cloudflare email protection (`/cdn-cgi/l/email-protection`).
- **Advanced Extraction**: Scans full HTML source (including meta tags and headers) for email addresses.
- **Modern UI**: Beautiful, responsive interface built with React, Framer Motion, and Lucide Icons.
- **Export**: Download results as a clean CSV file.
- **Fast & Safe**: Uses concurrent requests with limits and timeouts to ensure stability.

## Tech Stack
- **Backend**: Node.js, Express, Axios, Cheerio
- **Frontend**: React, Vite, Framer Motion, Lucide React
- **Styling**: Vanilla CSS with custom design system

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm

### Installation
1. Clone the repository
2. Install root dependencies:
   ```bash
   npm install
   ```
3. Install server dependencies:
   ```bash
   cd server && npm install
   ```
4. Install client dependencies:
   ```bash
   cd ../client && npm install
   ```

### Running the App
From the root directory, run:
```bash
npm run dev
```
The backend will start on port `5002` and the frontend on port `5174`.

## Usage
1. Enter a URL (e.g., `example.com` or `https://example.com`).
2. Select the search depth (Page Only, Depth 1, or Depth 2).
3. Click "Start Scraper".
4. Export results to CSV once complete.

## License
MIT
