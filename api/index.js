const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');

const app = express();
app.use(cors());
app.use(express.json());

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function getMainDomain(hostname) {
  return hostname.replace(/^www\./, '');
}

function decodeCloudflareEmail(encodedString) {
  try {
    let email = '';
    const key = parseInt(encodedString.substr(0, 2), 16);
    for (let n = 2; n < encodedString.length; n += 2) {
      const charCode = parseInt(encodedString.substr(n, 2), 16) ^ key;
      email += String.fromCharCode(charCode);
    }
    return email;
  } catch (e) {
    return null;
  }
}

async function scrapeEmails(targetUrl, depth = 1, visited = new Set()) {
  if (depth < 0 || visited.has(targetUrl)) return [];
  visited.add(targetUrl);

  try {
    console.log(`Scraping: ${targetUrl} (Depth: ${depth})`);
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: false
    });

    console.log(`Response status: ${response.status} for ${targetUrl}`);
    if (response.status !== 200) {
      console.warn(`Failed to fetch ${targetUrl}: ${response.status}`);
      return [];
    }

    const html = response.data;
    if (typeof html !== 'string') {
      console.warn(`URL ${targetUrl} did not return HTML content`);
      return [];
    }

    const $ = cheerio.load(html);
    const text = $.text();
    const foundEmails = text.match(EMAIL_REGEX) || [];
    
    $('a[href^="mailto:"]').each((i, el) => {
      let email = $(el).attr('href').replace('mailto:', '').split('?')[0];
      email = email.trim();
      if (email && EMAIL_REGEX.test(email)) {
        foundEmails.push(email);
      }
    });

    const cfLinks = $('a[href*="/cdn-cgi/l/email-protection#"]');
    console.log(`Found ${cfLinks.length} Cloudflare links`);
    cfLinks.each((i, el) => {
      const href = $(el).attr('href');
      console.log(`Processing link: ${href}`);
      const parts = href.split('#');
      const encoded = parts.length > 1 ? parts[1] : null;
      if (encoded) {
        const decoded = decodeCloudflareEmail(encoded);
        if (decoded) foundEmails.push(decoded);
      }
    });

    // Extract unique emails
    const uniqueEmails = [...new Set(foundEmails)];
    console.log(`Found ${uniqueEmails.length} emails on ${targetUrl}`);

    // Recursive scraping for depth > 0
    if (depth > 0) {
      const baseUrl = new URL(targetUrl);
      const domain = baseUrl.hostname;
      const mainDomain = getMainDomain(domain);

      $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        try {
          let fullUrl;
          if (href.startsWith('/')) {
            fullUrl = `${baseUrl.protocol}//${baseUrl.host}${href}`;
          } else if (href.startsWith('http')) {
            fullUrl = href;
          } else {
            fullUrl = new URL(href, targetUrl).href;
          }

          const linkUrl = new URL(fullUrl);
          const linkDomain = getMainDomain(linkUrl.hostname);

          if (linkDomain === mainDomain && !visited.has(fullUrl)) {
            console.log(`Following link: ${fullUrl}`);
            scrapeEmails(fullUrl, depth - 1, visited);
          }
        } catch (e) {
          // Skip invalid URLs
        }
      });
    }

    return uniqueEmails;
  } catch (error) {
    console.error(`Error scraping ${targetUrl}:`, error.message);
    return [];
  }
}

app.post('/api/scrape', async (req, res) => {
  const { url: targetUrl, depth = 1 } = req.body;

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL is required' });
  }

  let normalizedUrl = targetUrl;
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  try {
    new URL(normalizedUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    const emails = await scrapeEmails(normalizedUrl, parseInt(depth));
    res.json({ success: true, emails, count: emails.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = app;
