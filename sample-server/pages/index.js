import { useEffect, useState, useCallback } from 'react';
import Error from '../components/Error';
import styles from '../styles/Home.module.css';

const SampleCard = ({ sample }) => (
  <div key={sample.id} className={styles.card}>
    <h3>Sample {sample.id}</h3>
    <p>Downloaded: {new Date(sample.downloaded).toLocaleString()}</p>
    {sample.size && (
      <p className={styles.size}>Size: {(sample.size / 1024 / 1024).toFixed(2)} MB</p>
    )}
    {sample.description && (
      <p className={styles.description}>{sample.description}</p>
    )}
    {sample.path && (
      <>
        <audio
          controls
          src={`${process.env.NODE_ENV === 'production' ? '/sample-server' : ''}${sample.path}`}
          onError={(e) => console.error('Audio error:', e)}
        />
        <p className={styles.source}>
          Source: {sample.source || 'Database'}
        </p>
      </>
    )}
  </div>
);

const BufferStats = ({ stats }) => (
  <div className={styles.bufferStats}>
    <h3>Buffer Usage</h3>
    <div className={styles.statsGrid}>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Used:</span>
        <span className={styles.statValue}>
          {(stats.totalSize / 1024 / 1024).toFixed(2)} MB
        </span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Total:</span>
        <span className={styles.statValue}>
          {(stats.maxSize / 1024 / 1024).toFixed(0)} MB
        </span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Samples:</span>
        <span className={styles.statValue}>{stats.sampleCount}</span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Usage:</span>
        <span className={styles.statValue}>{stats.usagePercent}%</span>
      </div>
    </div>
    <div className={styles.progressBar}>
      <div 
        className={styles.progress} 
        style={{ width: `${stats.usagePercent}%` }}
      />
    </div>
  </div>
);

export default function Home() {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState({ loading: false, error: null });
  const [latestSample, setLatestSample] = useState(null);
  const [bufferStats, setBufferStats] = useState(null);

  const fetchSamples = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching samples...');
      const basePath = process.env.NODE_ENV === 'production' ? '/sample-server' : '';
      const response = await fetch(`${basePath}/api/samples`);
      console.log('Response:', response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error('Error response text:', text);
        try {
          const data = JSON.parse(text);
          throw new Error(data.error || data.details || `HTTP error! status: ${response.status}`);
        } catch (parseError) {
          throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}...`);
        }
      }
      
      const data = await response.json();
      console.log('Samples data:', data);
      
      setSamples(data.results || []);
      setBufferStats(data.bufferStats);
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch samples';
      console.error('Error fetching samples:', {
        message: errorMessage,
        error: err,
        stack: err.stack
      });
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
      setLatestSample(null);
      
      console.log('Fetching random sample...');
      const basePath = process.env.NODE_ENV === 'production' ? '/sample-server' : '';
      const response = await fetch(`${basePath}/api/random`);
      console.log('Random response:', response.status);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('Error response text:', text);
        try {
          const data = JSON.parse(text);
          throw new Error(data.error || data.details || `HTTP error! status: ${response.status}`);
        } catch (parseError) {
          throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}...`);
        }
      }

      const data = await response.json();
      console.log('Random sample data:', data);
      
      // Set the latest sample
      setLatestSample({
        ...data,
        downloaded: new Date().toISOString()
      });
      
      // Refresh the list after getting a new sample
      await fetchSamples();
      setApiStatus({ loading: false, error: null });
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch random sample';
      console.error('Error fetching random sample:', {
        message: errorMessage,
        error: err,
        stack: err.stack
      });
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
        
        {bufferStats && <BufferStats stats={bufferStats} />}
        
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

        {/* Latest random sample */}
        {latestSample && (
          <div className={styles.latestSample}>
            <h2>Latest Random Sample</h2>
            <SampleCard sample={latestSample} />
          </div>
        )}

        {error ? (
          <Error 
            message={error}
            onRetry={fetchSamples}
          />
        ) : (
          <>
            <h2 className={styles.sectionTitle}>All Samples</h2>
            <div className={styles.grid}>
              {samples.length === 0 ? (
                <p className={styles.noSamples}>
                  No samples available. Click "Get Random Sample" to fetch one from Freesound.org.
                  <br />
                  <small>Make sure your Freesound API key is set in the .env file.</small>
                </p>
              ) : (
                samples.map(sample => (
                  <SampleCard key={sample.id} sample={sample} />
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}