import styles from './present-self.module.css';

export default function MeLoading() {
  return <main className={styles.page} aria-busy="true" aria-live="polite">
    <span className="sr-only">正在加载此刻的你</span>
    <div className={styles.loadingNav}><i /><i /><i /><i /></div>
    <div className={styles.shell}>
      <div className={styles.layout}>
        <section className={`${styles.formCard} ${styles.loadingCard}`}>
          <i className={styles.loadingTitle} /><i /><i /><i className={styles.loadingArea} /><i className={styles.loadingArea} /><i />
        </section>
        <aside className={styles.sidebar}>
          <section className={`${styles.sideCard} ${styles.loadingCard}`}><i /><i /><i /><i /></section>
          <section className={`${styles.sideCard} ${styles.loadingCard}`}><i /><i className={styles.loadingArea} /></section>
        </aside>
      </div>
    </div>
  </main>;
}
