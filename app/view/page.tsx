'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import '@/styles/schedule-grid.css';
import TaskDetailModal from '@/components/TaskDetailModal';
import * as XLSX from 'xlsx';

interface Task {
    id: string;
    ship: any;
    location: any;
    blockInfo: string | null;
    freeFormTitle: string | null;
    personInCharge: string | null;
    requestedDate: string;
    requestedTime: string;
    scheduledDate: string | null;
    scheduledStartTime: string | null;
    scheduledEndTime: string | null;
    duration: number | null;
    notes: string | null;
    specialStatus: string | null;
    status: string;
    createdAt: string;
}

interface Location {
    id: string;
    code: string;
    name: string;
    displayOrder: number;
}

export default function ViewPage() {
    const [selectedDate, setSelectedDate] = useState('');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    // Initialize with today's date
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
    }, []);

    // Fetch locations
    useEffect(() => {
        const fetchLocations = async () => {
            try {
                const res = await fetch('/api/locations');
                const data = await res.json();
                setLocations(data);
            } catch (error) {
                console.error('Error fetching locations:', error);
            }
        };
        fetchLocations();
    }, []);

    // Fetch tasks when date changes
    useEffect(() => {
        if (selectedDate) {
            fetchTasks();
        }
    }, [selectedDate]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/tasks?date=${selectedDate}`);
            const data = await res.json();
            setTasks(data);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    // Generate time slots from 7:00 to 19:00 (30-minute intervals)
    const timeSlots: string[] = [];
    for (let hour = 7; hour <= 19; hour++) {
        for (let minute of ['00', '30']) {
            if (hour === 19 && minute === '30') break;
            timeSlots.push(`${hour.toString().padStart(2, '0')}:${minute}`);
        }
    }

    // Grid Helper Functions
    const getGridColumnStart = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        // 7:00 is col 2 (col 1 is location)
        // (h - 7) * 2 + (m/30) + 2
        return (h - 7) * 2 + (m === 30 ? 1 : 0) + 2;
    };

    const getGridColumnSpan = (duration: number) => {
        return Math.ceil(duration / 30);
    };

    const getTaskDisplay = (task: Task) => {
        const shipNumber = task.ship?.shipNumber ? task.ship.shipNumber.replace('S', '') : '';
        const blockParts = task.blockInfo ? task.blockInfo.split(' - ') : [];
        const section = blockParts[1] || '';
        const blockName = blockParts[blockParts.length - 1] || task.freeFormTitle || '';
        return {
            shipNumber,
            section,
            blockName,
        };
    };

    const getStartMins = (task: Task) => {
        const t = task.scheduledStartTime || task.requestedTime;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    // Improved Overlap Calculation Logic (Strict Split) - Shared with SchedulePage
    const calculateTaskLayout = (locationTasks: Task[]) => {
        const sortedTasks = [...locationTasks].sort((a, b) => {
            const startA = getStartMins(a);
            const startB = getStartMins(b);
            if (startA !== startB) return startA - startB;
            return (b.duration || 60) - (a.duration || 60);
        });

        const layoutMap = new Map<string, { index: number; total: number; conflict: boolean }>();
        const clusters: Task[][] = [];

        // 1. Build Clusters
        let currentCluster: Task[] = [];
        let clusterEnd = -1;

        sortedTasks.forEach(task => {
            const start = getStartMins(task);
            const end = start + (task.duration || 60);
            if (currentCluster.length === 0) {
                currentCluster.push(task);
                clusterEnd = end;
            } else {
                if (start < clusterEnd) {
                    currentCluster.push(task);
                    clusterEnd = Math.max(clusterEnd, end);
                } else {
                    clusters.push(currentCluster);
                    currentCluster = [task];
                    clusterEnd = end;
                }
            }
        });
        if (currentCluster.length > 0) clusters.push(currentCluster);

        // 2. Assign Lanes
        clusters.forEach(cluster => {
            const lanes: Task[][] = [];

            cluster.forEach(task => {
                const start = getStartMins(task);
                let laneIndex = -1;
                for (let i = 0; i < lanes.length; i++) {
                    const lastTask = lanes[i][lanes[i].length - 1];
                    const lastEnd = getStartMins(lastTask) + (lastTask.duration || 60);
                    if (start >= lastEnd) {
                        laneIndex = i;
                        break;
                    }
                }
                if (laneIndex === -1) {
                    laneIndex = lanes.length;
                    lanes.push([]);
                }
                lanes[laneIndex].push(task);
            });

            const totalLanes = lanes.length;

            // Populate map
            cluster.forEach(task => {
                let myLane = -1;
                lanes.forEach((l, idx) => { if (l.includes(task)) myLane = idx; });

                layoutMap.set(task.id, {
                    index: myLane,
                    total: totalLanes,
                    conflict: totalLanes > 1
                });
            });
        });

        return layoutMap;
    };

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        const header = ['場所', ...timeSlots];
        const rows = locations.map(loc => {
            const locTasks = tasks.filter(t => t.location.id === loc.id);
            const row: string[] = [loc.name];
            timeSlots.forEach(time => {
                const taskAtTime = locTasks.find(t => (t.scheduledStartTime || t.requestedTime) === time);
                if (taskAtTime) {
                    const display = getTaskDisplay(taskAtTime);
                    row.push(`(${display.shipNumber}) ${display.section} ${display.blockName}`);
                } else {
                    row.push('');
                }
            });
            return row;
        });
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
        XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
        XLSX.writeFile(wb, `Dejihai_Schedule_${selectedDate}.xlsx`);
    };

    return (
        <div className="container">
            <nav className="nav" style={{ backgroundColor: 'var(--color-view-bg)', borderColor: 'var(--color-view-border)' }}>
                <ul className="nav-links">
                    <li><Link href="/">ホーム</Link></li>
                    <li><Link href="/request">依頼入力</Link></li>
                    <li><Link href="/schedule">スケジュール調整</Link></li>
                    <li><Link href="/view" className="active">スケジュール閲覧</Link></li>
                </ul>
            </nav>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
                <h1 style={{ margin: 0 }}>👁️ スケジュール閲覧 (最新)</h1>
                <span style={{
                    backgroundColor: 'var(--color-success)',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-base)',
                    fontWeight: 600
                }}>
                    閲覧専用
                </span>
            </div>

            <p className="text-muted mb-lg" style={{ fontSize: 'var(--font-size-lg)' }}>
                確定したスケジュールを確認できます（編集不可）
            </p>

            <div className="control-panel" style={{ borderColor: 'var(--color-view-border)' }}>
                <label htmlFor="date">
                    対象日:
                    <input
                        id="date"
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{ marginLeft: 'var(--spacing-sm)' }}
                    />
                </label>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--spacing-sm)' }}>
                    <button onClick={handleExportExcel} style={{ backgroundColor: '#27ae60' }}>
                        📊 Excel保存
                    </button>
                    <button onClick={() => window.print()} style={{ backgroundColor: 'var(--color-accent-primary)' }}>
                        🖨️ PDFで保存/印刷
                    </button>
                    <button onClick={fetchTasks} className="secondary">
                        更新
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                    <div className="loading"></div>
                </div>
            ) : (
                <div className="schedule-container view-mode">
                    {/* Header Row */}
                    <div className="schedule-row" style={{
                        display: 'grid',
                        gridTemplateColumns: '150px repeat(25, 100px)',
                        position: 'sticky',
                        top: 0,
                        zIndex: 20
                    }}>
                        <div className="schedule-header-cell" style={{ gridColumn: 1 }}>定盤</div>
                        {timeSlots.map((time, i) => (
                            <div key={time} className="schedule-header-cell" style={{ gridColumn: i + 2 }}>
                                {time}
                            </div>
                        ))}
                    </div>

                    {/* Location Rows */}
                    {locations.map(location => {
                        const locationTasks = tasks.filter(t => t.location.id === location.id);
                        const layoutMap = calculateTaskLayout(locationTasks);

                        return (
                            <div
                                key={location.id}
                                className="schedule-row"
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '150px repeat(25, 100px)',
                                    borderBottom: '1px solid var(--color-border)',
                                    position: 'relative',
                                    minHeight: '100px',
                                    height: `${Math.max(1, Array.from(layoutMap.values()).reduce((max, l) => Math.max(max, l.total), 0)) * 85 + 10}px`
                                }}
                            >
                                <div className="location-cell" style={{ gridColumn: 1, gridRow: 1 }}>{location.name}</div>

                                {/* Background Grid Cells */}
                                {timeSlots.map((time, i) => (
                                    <div
                                        key={`${location.id}_${time}`}
                                        className="time-cell"
                                        style={{
                                            gridColumn: i + 2,
                                            gridRow: 1,
                                            height: '100px',
                                            borderRight: '1px solid var(--color-border)',
                                            position: 'relative',
                                            zIndex: 1
                                        }}
                                    />
                                ))}

                                {/* Task Cards */}
                                {locationTasks
                                    .map(task => {
                                        const colStart = getGridColumnStart(task.scheduledStartTime || task.requestedTime);
                                        const colSpan = getGridColumnSpan(task.duration || 60);
                                        const display = getTaskDisplay(task);

                                        const layout = layoutMap.get(task.id) || { index: 0, total: 1, conflict: false };
                                        const heightPercent = 100 / layout.total;
                                        const topPercent = heightPercent * layout.index;


                                        return (
                                            <div
                                                key={task.id}
                                                className={`task-card ${task.status.toLowerCase()} ${layout.conflict ? 'conflict' : ''}`}
                                                style={{
                                                    gridColumn: `${colStart} / span ${colSpan}`,
                                                    gridRow: 1,
                                                    zIndex: 10 + layout.index,
                                                    top: `${layout.index * 85}px`,
                                                    height: `80px`,
                                                    width: 'calc(100% - 8px)',
                                                    margin: '2px 4px',
                                                    cursor: 'pointer',
                                                    position: 'absolute'
                                                }}
                                                onClick={() => setSelectedTask(task)}
                                            >
                                                <div className="task-card-header" style={{ fontSize: '12px' }}>
                                                    <div style={{ fontWeight: 700, display: 'flex', flexWrap: 'wrap', gap: '2px', overflow: 'hidden' }}>
                                                        {task.specialStatus && (
                                                            <span className="task-card-special-status" style={{ fontSize: '14px' }}>{task.specialStatus}</span>
                                                        )}
                                                        <span style={{ color: '#ffd700' }}>{display.shipNumber && `(${display.shipNumber})`}</span>
                                                        <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0 4px', borderRadius: '2px' }}>{display.section}</span>
                                                        <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{display.blockName}</span>
                                                    </div>
                                                </div>
                                                {task.notes && (
                                                    <div className="task-card-notes" style={{ fontSize: '10px' }}>
                                                        {task.notes}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                />
            )}
        </div>
    );
}
