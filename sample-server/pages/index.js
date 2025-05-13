import { useEffect, useState, useCallback } from 'react';
import Error from '../components/Error';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState({ loading: false, error: null });

  const fetchSamples = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching samples...');
      const response = await fetch('/api/samples');
      console.log('Response:', response.status);
      
      const data = await response.json();
      console.log('Samples data:', data);
      
      if (!response.ok) {
        throw new Error(data.error || data.details || `HTTP error! status: ${response.status}`);
      }
      data.results.sort((a, b) => new Date(b.downloaded) - new Date(a.downloaded));
      setSamples(data.results || []);
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch samples';
      console.error('Error fetching samples:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSamples();
  }, [fetchSamples]);

  const handleRefresh = async () => {
    try {
      setApiStatus({ loading: true, error: null });
      
      console.log('Fetching random sample...');
      const response = await fetch('/api/random');
      console.log('Random response:', response.status);
      
      const data = await response.json();
      console.log('Random sample data:', data);
      
      if (!response.ok) {
        throw new Error(data.error || data.details || `HTTP error! status: ${response.status}`);
      }
      
      // Refresh the list after getting a new sample
      await fetchSamples();
      setApiStatus({ loading: false, error: null });
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch random sample';
      console.error('Error fetching random sample:', err);
      setApiStatus({ loading: false, error: errorMessage });
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading samples...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Samples</h1>
        
        <div className={styles.controls}>
          <button 
            onClick={handleRefresh}
            className={styles.refreshButton}
            disabled={apiStatus.loading}
          >
            {apiStatus.loading ? 'Fetching...' : 'Get Random Sample'}
          </button>
          
          {apiStatus.error && (
            <div className={styles.apiError}>
              {apiStatus.error}
            </div>
          )}
        </div>

        {error ? (
          <Error 
            message={error}
            onRetry={fetchSamples}
          />
        ) : (
          <div className={styles.grid}>
            {samples.length === 0 ? (
              <p className={styles.noSamples}>
                No samples available. Click "Get Random Sample" to fetch one from Freesound.org.
                <br />
                <small>Make sure your Freesound API key is set in the .env file.</small>
              </p>
            ) : (
              samples.map((sample) => (
                <div key={sample.id} className={styles.card}>
                  <h3>Sample {sample.id}</h3>
                  <p>Downloaded: {new Date(sample.downloaded).toLocaleString()}</p>
                  {sample.path && (
                    <>
                      <audio 
                        controls 
                        src={sample.path}
                        onError={(e) => console.error('Audio error:', e)} 
                      />
                      <p className={styles.source}>
                        Source: {sample.source || 'Database'}
                      </p>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}