import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '配材スケジュール管理システム',
    description: '造船所向けスケジュール管理アプリケーション',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja">
            <body>{children}</body>
        </html>
    );
}
