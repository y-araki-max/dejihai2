'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import '@/styles/schedule-grid.css';
import TaskDetailModal from '@/components/TaskDetailModal';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    useSensor,
    useSensors,
    PointerSensor,
    closestCenter,
    DragOverEvent,
    useDraggable,
    useDroppable,
} from '@dnd-kit/core';

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

interface ResizeState {
    taskId: string;
    startX: number;
    startDuration: number;
}

export default function SchedulePage() {
    const [selectedDate, setSelectedDate] = useState('');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);
    const [resizing, setResizing] = useState<ResizeState | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

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
            setMessage({ type: 'error', text: 'タスクの読み込みに失敗しました' });
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { over } = event;
        setOverId(over ? (over.id as string) : null);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setOverId(null);

        if (!over) return;

        const taskId = active.id as string;
        const dropId = over.id as string;

        const [dropLocationId, timeSlot] = dropId.split('_');

        if (!dropLocationId || !timeSlot) return;

        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        // Block vertical movement (Location change)
        if (dropLocationId !== task.location.id) return;

        const duration = task.duration || 60;

        const [hours, minutes] = timeSlot.split(':').map(Number);
        const startTotalMins = hours * 60 + minutes;
        const endTotalMins = startTotalMins + duration;

        const endH = Math.floor(endTotalMins / 60);
        const endM = endTotalMins % 60;
        const scheduledEndTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

        try {
            // Optimistic update - Maintain original status (don't force SCHEDULED)
            setTasks(prev => prev.map(t =>
                t.id === taskId
                    ? { ...t, scheduledStartTime: timeSlot, scheduledEndTime }
                    : t
            ));

            const res = await fetch(`/api/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    locationId: dropLocationId, // Should be same
                    scheduledDate: selectedDate,
                    scheduledStartTime: timeSlot,
                    scheduledEndTime,
                    // DO NOT update status here to maintain original color
                }),
            });

            if (!res.ok) throw new Error('Failed to update task');

            setMessage({ type: 'success', text: 'スケジュールを更新しました' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error updating task:', error);
            setMessage({ type: 'error', text: 'スケジュールの更新に失敗しました' });
            fetchTasks(); // Revert on error
        }
    };

    const handleAddSpecialStatus = async (taskId: string, status: string) => {
        try {
            const task = tasks.find(t => t.id === taskId);
            const newStatus = task?.specialStatus === status ? null : status;

            // Optimistic update
            setTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, specialStatus: newStatus } : t
            ));

            const res = await fetch(`/api/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ specialStatus: newStatus }),
            });

            if (!res.ok) throw new Error('Failed to update status');
        } catch (error) {
            console.error('Error updating special status:', error);
            fetchTasks(); // Revert
        }
    };

    // Horizontal Resize Handlers
    const handleResizeStart = (e: React.MouseEvent, taskId: string) => {
        e.stopPropagation();
        e.preventDefault();
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        setResizing({
            taskId,
            startX: e.clientX,
            startDuration: task.duration || 60,
        });
    };

    useEffect(() => {
        if (!resizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!resizing) return;

            const deltaX = e.clientX - resizing.startX;
            // 100px = 30 minutes
            const deltaMinutes = Math.round(deltaX / 100) * 30;
            const newDuration = Math.max(30, resizing.startDuration + deltaMinutes);

            // Optimistic update for visual feedback
            setTasks(prev => prev.map(t =>
                t.id === resizing.taskId
                    ? { ...t, duration: newDuration }
                    : t
            ));
        };

        const handleMouseUp = async () => {
            if (!resizing) return;

            const task = tasks.find(t => t.id === resizing.taskId);
            if (!task) return;

            try {
                const startTime = task.scheduledStartTime || task.requestedTime;
                const [hours, minutes] = startTime.split(':').map(Number);

                const startTotalMins = hours * 60 + minutes;
                const endTotalMins = startTotalMins + (task.duration || 60);

                const endH = Math.floor(endTotalMins / 60);
                const endM = endTotalMins % 60;
                const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

                const res = await fetch(`/api/tasks/${resizing.taskId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        duration: task.duration,
                        scheduledEndTime: endTime,
                    }),
                });

                if (!res.ok) throw new Error('Failed to update duration');

                setMessage({ type: 'success', text: '作業時間を更新しました' });
                setTimeout(() => setMessage(null), 3000);
            } catch (error) {
                console.error('Error updating duration:', error);
                setMessage({ type: 'error', text: '作業時間の更新に失敗しました' });
                fetchTasks(); // Revert
            }

            setResizing(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizing, tasks]);

    // Generate time slots
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
        // blockInfo format: "ShipNumber - BlockName"
        const blockName = task.blockInfo ? task.blockInfo.split(' - ').pop() || task.blockInfo : (task.freeFormTitle || '');
        return {
            shipNumber,
            blockName,
        };
    };

    const getStartMins = (task: Task) => {
        const t = task.scheduledStartTime || task.requestedTime;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    // Improved Overlap Calculation Logic (Strict Split)
    const calculateTaskLayout = (locationTasks: Task[]) => {
        // Sort tasks by start time, then longer duration first
        const sortedTasks = [...locationTasks].sort((a, b) => {
            const startA = getStartMins(a);
            const startB = getStartMins(b);
            if (startA !== startB) return startA - startB;
            return (b.duration || 60) - (a.duration || 60);
        });

        const layoutMap = new Map<string, { index: number; total: number; conflict: boolean }>();
        const clusters: Task[][] = [];

        // 1. Build Clusters of overlapping tasks
        let currentCluster: Task[] = [];
        let clusterEnd = -1;

        sortedTasks.forEach(task => {
            const start = getStartMins(task);
            const end = start + (task.duration || 60);

            if (currentCluster.length === 0) {
                currentCluster.push(task);
                clusterEnd = end;
            } else {
                // Overlapping with current cluster?
                // Since sorted by start, we just check if start < clusterEnd
                if (start < clusterEnd) {
                    currentCluster.push(task);
                    clusterEnd = Math.max(clusterEnd, end);
                } else {
                    // No overlap, close cluster and start new
                    clusters.push(currentCluster);
                    currentCluster = [task];
                    clusterEnd = end;
                }
            }
        });
        if (currentCluster.length > 0) clusters.push(currentCluster);

        // 2. Assign Lanes within each cluster
        clusters.forEach(cluster => {
            const lanes: Task[][] = [];

            cluster.forEach(task => {
                const start = getStartMins(task);

                // Find First Fit lane
                let laneIndex = -1;
                for (let i = 0; i < lanes.length; i++) {
                    // Check if this lane is free at 'start'
                    // Since sorted by start time, we only need to check the last task in the lane
                    const lastTask = lanes[i][lanes[i].length - 1];
                    const lastEnd = getStartMins(lastTask) + (lastTask.duration || 60);

                    if (start >= lastEnd) {
                        laneIndex = i;
                        break;
                    }
                }

                if (laneIndex === -1) {
                    // New lane
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
                    total: totalLanes, // Shared denominator for the cluster
                    conflict: totalLanes > 1
                });
            });
        });

        return layoutMap;
    };

    const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

    // --- Sub-components for DnD ---

    function DroppableTimeCell({ id, i, isOver }: any) {
        const { setNodeRef } = useDroppable({ id });
        return (
            <div
                ref={setNodeRef}
                className={`time-cell ${isOver ? 'droppable' : ''}`}
                style={{
                    gridColumn: i + 2,
                    gridRow: 1,
                    height: '100%',
                    borderRight: '1px solid var(--color-border)',
                    position: 'relative',
                    zIndex: 1
                }}
            >
                {isOver && !activeTask && <div className="drop-placeholder">ここに移動</div>}
            </div>
        );
    }

    function DraggableTaskCard({ task, layout, display }: any) {
        const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
            id: task.id,
        });

        const colStart = getGridColumnStart(task.scheduledStartTime || task.requestedTime);
        const colSpan = getGridColumnSpan(task.duration || 60);

        const style = {
            gridColumn: `${colStart} / span ${colSpan}`,
            gridRow: 1,
            zIndex: 10 + layout.index,
            top: `${layout.index * 85}px`,
            height: `80px`,
            width: 'calc(100% - 8px)',
            margin: '2px 4px',
            position: 'absolute' as const,
            transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
            opacity: isDragging ? 0 : 1, // Hide original while dragging
        };

        return (
            <div
                ref={setNodeRef}
                style={style}
                {...listeners}
                {...attributes}
                className={`task-card ${task.status.toLowerCase()} ${layout.conflict ? 'conflict' : ''}`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!resizing) setSelectedTask(task);
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddSpecialStatus(task.id, '㊏');
                }}
            >
                <div className="task-card-header" style={{ fontSize: '12px', pointerEvents: 'none' }}>
                    <div style={{ fontWeight: 700, display: 'flex', flexWrap: 'wrap', gap: '4px', overflow: 'hidden' }}>
                        {task.specialStatus && (
                            <span className="task-card-special-status" style={{ fontSize: '14px' }}>{task.specialStatus}</span>
                        )}
                        <span style={{ color: '#ffd700' }}>{display.shipNumber && `(${display.shipNumber})`}</span>
                        <span>/</span>
                        <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{display.blockName}</span>
                    </div>
                </div>
                <div
                    className="task-card-resize-handle"
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        handleResizeStart(e, task.id);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="container">
            <nav className="nav">
                <ul className="nav-links">
                    <li><Link href="/">ホーム</Link></li>
                    <li><Link href="/request">依頼入力</Link></li>
                    <li><Link href="/schedule" className="active">スケジュール調整</Link></li>
                    <li><Link href="/view">スケジュール閲覧</Link></li>
                </ul>
            </nav>

            <h1>📅 スケジュール調整</h1>
            <p className="text-muted mb-lg" style={{ fontSize: 'var(--font-size-lg)' }}>
                管理者用：配材スケジュールを調整してください
            </p>

            {message && (
                <div className={`alert alert-${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="control-panel">
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
                <button onClick={fetchTasks} className="secondary" style={{ marginLeft: 'auto' }}>更新</button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                    <div className="loading"></div>
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <div className="schedule-container">
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
                                    {/* Location Header */}
                                    <div className="location-cell" style={{ gridColumn: 1, gridRow: 1 }}>
                                        {location.name}
                                    </div>

                                    {/* Droppable Background Cells */}
                                    {timeSlots.map((time, i) => {
                                        const cellId = `${location.id}_${time}`;
                                        const isOver = overId === cellId;
                                        return (
                                            <DroppableTimeCell
                                                key={cellId}
                                                id={cellId}
                                                i={i}
                                                isOver={isOver}
                                            />
                                        );
                                    })}

                                    {/* Task Cards Layered on Top */}
                                    {locationTasks.map(task => {
                                        const display = getTaskDisplay(task);
                                        const layout = layoutMap.get(task.id) || { index: 0, total: 1, conflict: false };
                                        return (
                                            <DraggableTaskCard
                                                key={task.id}
                                                task={task}
                                                layout={layout}
                                                display={display}
                                            />
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>

                    <DragOverlay>
                        {activeTask && (
                            <div
                                className={`task-card ${activeTask.status.toLowerCase()}`}
                                style={{
                                    width: `${getGridColumnSpan(activeTask.duration || 60) * 100}px`,
                                    height: '92px'
                                }}
                            >
                                <div className="task-card-header">
                                    {activeTask.specialStatus && <span className="task-card-special-status">{activeTask.specialStatus}</span>}
                                    <div style={{ fontWeight: 700, fontSize: '16px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        <span style={{ color: '#ffd700' }}>({getTaskDisplay(activeTask).shipNumber})</span>
                                        <span>/</span>
                                        <span>{getTaskDisplay(activeTask).blockName}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            )}

            {selectedTask && (
                <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
            )}
        </div>
    );
}
