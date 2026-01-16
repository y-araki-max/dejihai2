'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Ship {
    id: string;
    shipNumber: string;
    name: string | null;
}

interface Location {
    id: string;
    code: string;
    name: string;
}

interface BlockData {
    grouped: Record<string, Record<string, string[]>>;
}

export default function RequestPage() {
    const [ships, setShips] = useState<Ship[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedShipId, setSelectedShipId] = useState('');
    const [blockData, setBlockData] = useState<BlockData | null>(null);
    const [isFreeForm, setIsFreeForm] = useState(false);
    const [keepInputting, setKeepInputting] = useState(false); // 続けて入力するかどうか

    // Form fields
    const [freeFormTitle, setFreeFormTitle] = useState('');
    const [selectedBlock, setSelectedBlock] = useState('');
    const [requestedDate, setRequestedDate] = useState('');
    const [requestedTime, setRequestedTime] = useState('08:00');
    const [locationId, setLocationId] = useState('');
    const [notes, setNotes] = useState('');

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Fetch ships and locations on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [shipsRes, locationsRes] = await Promise.all([
                    fetch('/api/ships'),
                    fetch('/api/locations'),
                ]);

                const shipsData = await shipsRes.json();
                const locationsData = await locationsRes.json();

                setShips(shipsData);
                setLocations(locationsData);

                // Set default date to today
                const today = new Date().toISOString().split('T')[0];
                setRequestedDate(today);
            } catch (error) {
                console.error('Error fetching data:', error);
                setMessage({ type: 'error', text: 'データの読み込みに失敗しました' });
            }
        };

        fetchData();
    }, []);

    // Fetch blocks when ship is selected
    useEffect(() => {
        if (selectedShipId && !isFreeForm) {
            const fetchBlocks = async () => {
                try {
                    const res = await fetch(`/api/blocks?shipId=${selectedShipId}`);
                    const data = await res.json();
                    setBlockData(data);
                    setSelectedBlock('');
                } catch (error) {
                    console.error('Error fetching blocks:', error);
                }
            };

            fetchBlocks();
        }
    }, [selectedShipId, isFreeForm]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            let blockInfo = null;

            if (!isFreeForm && selectedShipId && selectedBlock) {
                const ship = ships.find(s => s.id === selectedShipId);
                blockInfo = `${ship?.shipNumber || ''} - ${selectedBlock}`.trim();
            }

            const payload = {
                shipId: isFreeForm ? null : (selectedShipId || null),
                blockInfo,
                freeFormTitle: isFreeForm ? freeFormTitle : null,
                requestedDate,
                requestedTime,
                locationId,
                notes,
            };

            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error('Failed to create task');

            setMessage({ type: 'success', text: '依頼を登録しました' });

            // フォームのリセット
            setFreeFormTitle('');
            setSelectedShipId('');
            setSelectedBlock('');
            setNotes('');
            setLocationId('');
            setRequestedTime('');

            // 続けて入力しない場合は、トップへ戻すか、メッセージを維持する
            if (!keepInputting) {
                // 必要に応じて自動で一覧へ戻すなどの処理が可能ですが、
                // 今回はシンプルにリセットのみ行います
            } else {
                // 続けて入力する場合は、メッセージを3秒後に消す
                setTimeout(() => setMessage(null), 3000);
            }

        } catch (error) {
            console.error('Error creating task:', error);
            setMessage({ type: 'error', text: '依頼の登録に失敗しました' });
        } finally {
            setLoading(false);
        }
    };

    // Get all unique block names from blockData
    const allBlocks: string[] = [];
    if (blockData?.grouped) {
        Object.values(blockData.grouped).forEach(sections => {
            Object.values(sections).forEach(blocks => {
                allBlocks.push(...blocks);
            });
        });
    }

    return (
        <div className="container">
            <nav className="nav">
                <ul className="nav-links">
                    <li><Link href="/">ホーム</Link></li>
                    <li><Link href="/request" className="active">依頼入力</Link></li>
                    <li><Link href="/schedule">スケジュール調整</Link></li>
                    <li><Link href="/view">スケジュール閲覧</Link></li>
                </ul>
            </nav>

            <h1>📝 配材依頼入力</h1>
            <p className="text-muted mb-lg" style={{ fontSize: 'var(--font-size-lg)' }}>
                現場スタッフ用：配材依頼を入力してください
            </p>

            {message && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="card" style={{ border: '2px solid var(--color-input-border)' }}>


                    <div className="form-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={isFreeForm}
                                onChange={(e) => setIsFreeForm(e.target.checked)}
                                style={{ width: 'auto', marginRight: 'var(--spacing-sm)' }}
                            />
                            自由入力モード（マスタにない項目を入力する場合）
                        </label>
                    </div>

                    {isFreeForm ? (
                        <div className="form-group">
                            <label htmlFor="freeFormTitle">項目名</label>
                            <input
                                id="freeFormTitle"
                                type="text"
                                value={freeFormTitle}
                                onChange={(e) => setFreeFormTitle(e.target.value)}
                                placeholder="例: ゴミ出し、清掃、連絡事項"
                            />
                        </div>
                    ) : (
                        <>
                            <div className="form-group">
                                <label htmlFor="ship">工事番号（番船）</label>
                                <select
                                    id="ship"
                                    value={selectedShipId}
                                    onChange={(e) => setSelectedShipId(e.target.value)}
                                >
                                    <option value="">選択してください</option>
                                    {ships.map((ship) => (
                                        <option key={ship.id} value={ship.id}>
                                            {ship.shipNumber} {ship.name && `- ${ship.name}`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedShipId && blockData && (
                                <div className="form-group">
                                    <label htmlFor="block">ブロック</label>
                                    <select
                                        id="block"
                                        value={selectedBlock}
                                        onChange={(e) => setSelectedBlock(e.target.value)}
                                    >
                                        <option value="">選択してください</option>
                                        {allBlocks.map((block, idx) => (
                                            <option key={idx} value={block}>
                                                {block}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </>
                    )}

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="date">希望搬入日 *</label>
                            <input
                                id="date"
                                type="date"
                                value={requestedDate}
                                onChange={(e) => setRequestedDate(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="time">希望時間 *</label>
                            <select
                                id="time"
                                value={requestedTime}
                                onChange={(e) => setRequestedTime(e.target.value)}
                                required
                            >
                                {Array.from({ length: 25 }, (_, i) => {
                                    const hour = Math.floor(i / 2) + 7;
                                    const minute = i % 2 === 0 ? '00' : '30';
                                    if (hour > 19) return null;
                                    const timeStr = `${hour.toString().padStart(2, '0')}:${minute}`;
                                    return (
                                        <option key={timeStr} value={timeStr}>
                                            {timeStr}
                                        </option>
                                    );
                                }).filter(Boolean)}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="location">搬入定盤 *</label>
                            <select
                                id="location"
                                value={locationId}
                                onChange={(e) => setLocationId(e.target.value)}
                                required
                            >
                                <option value="">選択してください</option>
                                {locations.map((loc) => (
                                    <option key={loc.id} value={loc.id}>
                                        {loc.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="notes">備考（詳細情報）</label>
                        <textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="例: (08)N6s 5F部材 8:00"
                            rows={6}
                        />
                        <p className="text-muted" style={{ fontSize: '14px', marginTop: 'var(--spacing-xs)' }}>
                            作業の詳細（小物、ガーター、板継など）を記入してください
                        </p>
                    </div>

                    <div className="form-group" style={{ marginBottom: 'var(--spacing-lg)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={keepInputting}
                                onChange={(e) => setKeepInputting(e.target.checked)}
                                style={{ width: '24px', height: '24px', marginRight: 'var(--spacing-sm)' }}
                            />
                            <strong>続けて別の依頼を入力しますか？</strong>
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)' }}>
                        <button type="submit" disabled={loading}>
                            {loading ? '登録中...' : '依頼を登録'}
                        </button>
                        <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                                setFreeFormTitle('');
                                setSelectedShipId('');
                                setSelectedBlock('');
                                setNotes('');
                            }}
                        >
                            クリア
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
