import { DigestCard } from "@/components/digest-card";
import { ChatPanel } from "@/components/chat-panel";
import { bootstrapMessages, getQuickActions } from "@/lib/chat-service";
import { listDigests } from "@/lib/digest-service";
import styles from "./page.module.css";

export default async function Home() {
  const [digests, messages, quickActions] = await Promise.all([
    listDigests(),
    bootstrapMessages(),
    Promise.resolve(getQuickActions()),
  ]);

  const latest = digests[0];

  return (
    <div className={styles.grid}>
      <section className={styles.left}>
        <p className={styles.sectionTitle}>Daily digest</p>
        {digests.length ? (
          <>
            <div className={styles.digestList}>
              {digests.map((digest) => (
                <DigestCard key={digest.id} digest={digest} />
              ))}
            </div>

            {latest ? (
              <>
                <div className={styles.incidents}>
                  <p className={styles.sectionTitle}>Incidents & risks</p>
                  <ul>
                    {latest.incidents.length ? (
                      latest.incidents.map((incident, index) => (
                        <li key={incident}>{incident ?? `Incident ${index + 1}`}</li>
                      ))
                    ) : (
                      <li>No incidents captured in the last cycle.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className={styles.sectionTitle}>Source of truth</p>
                  <div className={styles.sources}>
                    {latest.sources.map((source) => (
                      <span key={source} className={styles.source}>
                        {source}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </>
        ) : (
          <p>No digests yet. Use “Trigger digest” to create the first one.</p>
        )}
      </section>

      <section className={styles.right}>
        <ChatPanel
          seedMessages={messages}
          quickActions={quickActions}
          latestDigest={latest}
        />
      </section>
    </div>
  );
}
