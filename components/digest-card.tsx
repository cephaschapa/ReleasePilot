import { DigestEntry } from "@/types/digest";
import styles from "./digest-card.module.css";

interface Props {
  digest: DigestEntry;
}

const statusCopy: Record<DigestEntry["status"], string> = {
  healthy: "Healthy",
  warning: "Watch",
  critical: "Critical",
};

export function DigestCard({ digest }: Props) {
  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div>
          <p className={styles.date}>
            {new Date(digest.date).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
          <h3>{digest.title}</h3>
        </div>
        <span className={`${styles.status} ${styles[digest.status]}`}>
          {statusCopy[digest.status]}
        </span>
      </header>

      <p className={styles.summary}>{digest.summary}</p>

      <div className={styles.metrics}>
        {digest.metrics.slice(0, 3).map((metric) => (
          <div key={metric.id} className={styles.metric}>
            <p className={styles.metricLabel}>{metric.label}</p>
            <div className={styles.metricValue}>
              <span>{metric.value}</span>
              <small>{metric.delta}</small>
            </div>
            <span className={`${styles.badge} ${styles[metric.status]}`}>
              {metric.status}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

