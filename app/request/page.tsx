'use client';

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

    // Form fields
    const [personInCharge, setPersonInCharge] = useState(''); // New field
    const [freeFormTitle, setFreeFormTitle] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedLargeBlock, setSelectedLargeBlock] = useState('');
    const [selectedMediumBlock, setSelectedMediumBlock] = useState('');
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
                    setSelectedSection('');
                    setSelectedLargeBlock('');
                    setSelectedMediumBlock('');
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

            if (!isFreeForm && selectedShipId) {
                const ship = ships.find(s => s.id === selectedShipId);
                // Construct block info even if partial
                const parts = [ship?.shipNumber, selectedSection, selectedLargeBlock, selectedMediumBlock].filter(Boolean);
                if (parts.length > 0) {
                    blockInfo = parts.join(' - ');
                }
            }

            const payload = {
                shipId: isFreeForm ? null : (selectedShipId || null),
                blockInfo,
                freeFormTitle: isFreeForm ? freeFormTitle : null,
                personInCharge: personInCharge || null,
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

            // Reset form (keep Person in Charge for convenience?) -> Maybe better to clear.
            setPersonInCharge('');
            setFreeFormTitle('');
            setSelectedShipId(''); // Reset ship selection
            setSelectedSection('');
            setSelectedLargeBlock('');
            setSelectedMediumBlock('');
            setNotes('');

        } catch (error) {
            console.error('Error creating task:', error);
            setMessage({ type: 'error', text: '依頼の登録に失敗しました' });
        } finally {
            setLoading(false);
        }
    };

    const sections = blockData?.grouped ? Object.keys(blockData.grouped) : [];
    const largeBlocks = selectedSection && blockData?.grouped[selectedSection]
        ? Object.keys(blockData.grouped[selectedSection])
        : [];
    const mediumBlocks = selectedSection && selectedLargeBlock && blockData?.grouped[selectedSection]?.[selectedLargeBlock]
        ? blockData.grouped[selectedSection][selectedLargeBlock]
        : [];

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

                    {/* New Field: Person in Charge */}
                    <div className="form-group">
                        <label htmlFor="personInCharge">名前（担当者名）</label>
                        <input
                            id="personInCharge"
                            type="text"
                            value={personInCharge}
                            onChange={(e) => setPersonInCharge(e.target.value)}
                            placeholder="山田 太郎"
                        />
                    </div>

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
                                <>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label htmlFor="section">区画</label>
                                            <select
                                                id="section"
                                                value={selectedSection}
                                                onChange={(e) => {
                                                    setSelectedSection(e.target.value);
                                                    setSelectedLargeBlock('');
                                                    setSelectedMediumBlock('');
                                                }}
                                            >
                                                <option value="">選択してください</option>
                                                {sections.map((section) => (
                                                    <option key={section} value={section}>
                                                        {section}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="largeBlock">大組</label>
                                            <select
                                                id="largeBlock"
                                                value={selectedLargeBlock}
                                                onChange={(e) => {
                                                    setSelectedLargeBlock(e.target.value);
                                                    setSelectedMediumBlock('');
                                                }}
                                                disabled={!selectedSection}
                                            >
                                                <option value="">選択してください</option>
                                                {largeBlocks.map((block) => (
                                                    <option key={block} value={block}>
                                                        {block}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="mediumBlock">中組</label>
                                            <select
                                                id="mediumBlock"
                                                value={selectedMediumBlock}
                                                onChange={(e) => setSelectedMediumBlock(e.target.value)}
                                                disabled={!selectedLargeBlock}
                                            >
                                                <option value="">選択してください</option>
                                                {mediumBlocks.map((block) => (
                                                    <option key={block} value={block}>
                                                        {block}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </>
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

                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)' }}>
                        <button type="submit" disabled={loading}>
                            {loading ? '登録中...' : '依頼を登録'}
                        </button>
                        <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                                setPersonInCharge('');
                                setFreeFormTitle('');
                                setSelectedShipId('');
                                setSelectedSection('');
                                setSelectedLargeBlock('');
                                setSelectedMediumBlock('');
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
