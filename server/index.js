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

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5002;

// Email regex - improved to catch more variations
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
      validateStatus: false // Check status manually
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
    
    // Find emails in all text (including head/meta)
    const text = $.text();
    const foundEmails = text.match(EMAIL_REGEX) || [];
    
    // Find emails in mailto links
    $('a[href^="mailto:"]').each((i, el) => {
      let email = $(el).attr('href').replace('mailto:', '').split('?')[0];
      email = email.trim();
      if (email && EMAIL_REGEX.test(email)) {
        foundEmails.push(email);
      }
    });

    // Decode Cloudflare protected emails
    const cfLinks = $('a[href*="/cdn-cgi/l/email-protection#"]');
    console.log(`Found ${cfLinks.length} Cloudflare links`);
    cfLinks.each((i, el) => {
      const href = $(el).attr('href');
      console.log(`Processing link: ${href}`);
      const parts = href.split('#');
      const encoded = parts.length > 1 ? parts[1] : null;
      if (encoded) {
        const decoded = decodeCloudflareEmail(encoded);
        console.log(`Decoded from link: ${decoded}`);
        if (decoded && EMAIL_REGEX.test(decoded)) {
          foundEmails.push(decoded);
        }
      }
    });

    // Also check for data-cfemail attributes
    const cfElements = $('[data-cfemail]');
    console.log(`Found ${cfElements.length} elements with data-cfemail`);
    cfElements.each((i, el) => {
      const encoded = $(el).attr('data-cfemail');
      const decoded = decodeCloudflareEmail(encoded);
      console.log(`Decoded from attribute: ${decoded}`);
      if (decoded && EMAIL_REGEX.test(decoded)) {
        foundEmails.push(decoded);
      }
    });

    let results = foundEmails.map(email => ({ email: email.toLowerCase(), source: targetUrl }));

    // Recursive scraping
    if (depth > 0) {
      const links = [];
      const baseHost = getMainDomain(new URL(targetUrl).hostname);

      $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          try {
            const resolvedUrl = new URL(href, targetUrl).href;
            const parsedResolved = new URL(resolvedUrl);

            // Only follow http/https links on the same main domain
            if ((parsedResolved.protocol === 'http:' || parsedResolved.protocol === 'https:') &&
                getMainDomain(parsedResolved.hostname) === baseHost) {
              links.push(resolvedUrl);
            }
          } catch (e) {
            // Ignore invalid URLs
          }
        }
      });

      // De-duplicate links and limit concurrent requests (increased to 10)
      const uniqueLinks = [...new Set(links)].slice(0, 10);
      const subResults = await Promise.all(
        uniqueLinks.map(link => scrapeEmails(link, depth - 1, visited))
      );
      results = results.concat(...subResults);
    }

    // De-duplicate results
    const uniqueResults = [];
    const seen = new Set();
    for (const item of results) {
      if (!seen.has(item.email)) {
        seen.add(item.email);
        uniqueResults.push(item);
      }
    }

    return uniqueResults;
  } catch (error) {
    console.error(`Error scraping ${targetUrl}:`, error.message);
    return [];
  }
}

app.post('/api/scrape', async (req, res) => {
  const { url, depth = 0 } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Basic URL validation
    try {
      new URL(normalizedUrl);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Limit depth for safety
    const safeDepth = Math.min(Math.max(0, parseInt(depth) || 0), 2);
    
    const emails = await scrapeEmails(normalizedUrl, safeDepth);
    res.json({ emails, count: emails.length });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to scrape: ' + error.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;

// Keep process alive
setInterval(() => {
  // Just keep the event loop busy
}, 1000 * 60 * 60);

