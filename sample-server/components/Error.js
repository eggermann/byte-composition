import styles from '../styles/Error.module.css';

export default function Error({ message, onRetry }) {
  return (
    <div className={styles.error}>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className={styles.retryButton}>
          Try Again
        </button>
      )}
    </div>
  );
}