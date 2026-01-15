import Link from 'next/link';

export default function HomePage() {
    return (
        <div className="container">
            <h1 className="text-center">配材スケジュール管理システム</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginTop: '3rem' }}>
                <Link href="/request" style={{ textDecoration: 'none' }}>
                    <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.3s ease', border: '2px solid var(--color-input-border)' }}>
                        <h2 style={{ color: 'var(--color-accent-primary)' }}>📝 依頼入力</h2>
                        <p style={{ fontSize: 'var(--font-size-base)', marginTop: 'var(--spacing-sm)' }}>
                            現場スタッフ用：配材依頼を入力します
                        </p>
                    </div>
                </Link>

                <Link href="/schedule" style={{ textDecoration: 'none' }}>
                    <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.3s ease', border: '2px solid var(--color-accent-secondary)' }}>
                        <h2 style={{ color: 'var(--color-accent-secondary)' }}>📅 スケジュール調整</h2>
                        <p style={{ fontSize: 'var(--font-size-base)', marginTop: 'var(--spacing-sm)' }}>
                            管理者用：スケジュールを調整・確定します
                        </p>
                    </div>
                </Link>

                <Link href="/view" style={{ textDecoration: 'none' }}>
                    <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.3s ease', border: '2px solid var(--color-success)' }}>
                        <h2 style={{ color: 'var(--color-success)' }}>👁️ スケジュール閲覧</h2>
                        <p style={{ fontSize: 'var(--font-size-base)', marginTop: 'var(--spacing-sm)' }}>
                            閲覧専用：確定したスケジュールを確認します
                        </p>
                    </div>
                </Link>
            </div>
        </div>
    );
}
