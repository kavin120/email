import React, { useState } from 'react';
import axios from 'axios';
import { Search, Mail, Download, Globe, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [url, setUrl] = useState('');
  const [depth, setDepth] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const handleScrape = async (e) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError('');
    setResults([]);

    try {
      const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:5001/api/scrape' : '/api/scrape';
      const response = await axios.post(API_URL, { 
        url, 
        depth 
      });
      setResults(response.data.emails);
      if (response.data.emails.length === 0) {
        setError('No emails found on this site.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect to the server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (results.length === 0) return;
    
    try {
      const headers = ['Email', 'Source URL'];
      const csvContent = [
        headers.join(','),
        ...results.map(r => `"${r.email.replace(/"/g, '""')}","${r.source.replace(/"/g, '""')}"`)
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      let filename = 'emails_export.csv';
      try {
        filename = `emails_${new URL(results[0].source).hostname}.csv`;
      } catch (e) {
        // Fallback filename
      }

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
      setError('Failed to export CSV.');
    }
  };

  return (
    <div className="app-container">
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1>Email Scraper</h1>
        <p className="subtitle">Extract professional contact information from any website instantly.</p>
      </motion.header>

      <motion.div 
        className="glass-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <form onSubmit={handleScrape}>
          <div className="input-group">
            <div style={{ position: 'relative', flex: 1 }}>
              <Globe style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={20} />
              <input 
                type="text" 
                placeholder="Enter website URL (e.g., example.com)" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{ paddingLeft: '3rem' }}
              />
            </div>
            <select 
              value={depth} 
              onChange={(e) => setDepth(e.target.value)}
              style={{ 
                background: 'rgba(15, 23, 42, 0.6)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '12px',
                padding: '0 1rem',
                color: 'white'
              }}
            >
              <option value={0}>Page Only</option>
              <option value={1}>Depth 1</option>
              <option value={2}>Depth 2</option>
            </select>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Search size={20} />}
              {loading ? 'Scraping...' : 'Start Scraper'}
            </button>
          </div>
        </form>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </motion.div>
          )}

          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="stats-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <CheckCircle2 color="var(--accent)" />
                  <span style={{ fontWeight: 600 }}>Scrape Complete</span>
                  <span className="count-chip">{results.length} Emails Found</span>
                </div>
                <button className="btn" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)' }} onClick={exportCSV}>
                  <Download size={18} />
                  Export CSV
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Email Address</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, idx) => (
                      <motion.tr 
                        key={idx} 
                        className="email-row"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Mail size={16} color="var(--primary)" />
                            {result.email}
                          </div>
                        </td>
                        <td>
                          <span className="source-badge" title={result.source}>
                            {result.source}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {loading && (
            <div className="loader">
              <div className="spinner"></div>
              <p className="subtitle">Searching for contact information...</p>
            </div>
          )}

          {!loading && results.length === 0 && !error && (
            <div className="empty-state">
              <Mail size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p>Enter a URL and click start to begin extraction</p>
            </div>
          )}
        </AnimatePresence>
      </motion.div>

      <footer style={{ marginTop: '4rem', textAlign: 'center', opacity: 0.5, fontSize: '0.9rem' }}>
        <p>&copy; 2026 Antigravity Email Extraction Tool. Use responsibly.</p>
      </footer>
    </div>
  );
}

export default App;
