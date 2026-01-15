'use client';

import { useState } from 'react';

interface TaskDetailModalProps {
    task: any;
    onClose: () => void;
}

export default function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
    if (!task) return null;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short',
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    ×
                </button>

                <div className="modal-header">
                    <h2>
                        {task.freeFormTitle || task.blockInfo || '配材タスク'}
                        {task.specialStatus && (
                            <span className="task-card-special-status" style={{ marginLeft: '1rem' }}>
                                {task.specialStatus}
                            </span>
                        )}
                    </h2>
                    <span className={`status-badge ${task.status.toLowerCase()}`}>
                        {task.status === 'PENDING' && '未調整'}
                        {task.status === 'SCHEDULED' && '調整済'}
                        {task.status === 'COMPLETED' && '完了'}
                    </span>
                </div>

                <div className="modal-body">
                    {task.ship && (
                        <div className="modal-field">
                            <div className="modal-field-label">工事番号</div>
                            <div className="modal-field-value">{task.ship.shipNumber}</div>
                        </div>
                    )}

                    {task.blockInfo && (
                        <div className="modal-field">
                            <div className="modal-field-label">ブロック情報</div>
                            <div className="modal-field-value">{task.blockInfo}</div>
                        </div>
                    )}

                    <div className="modal-field">
                        <div className="modal-field-label">搬入定盤</div>
                        <div className="modal-field-value">{task.location.name}</div>
                    </div>

                    <div className="modal-field">
                        <div className="modal-field-label">希望日時</div>
                        <div className="modal-field-value">
                            {formatDate(task.requestedDate)} {task.requestedTime}
                        </div>
                    </div>

                    {task.scheduledDate && (
                        <div className="modal-field">
                            <div className="modal-field-label">調整後日時</div>
                            <div className="modal-field-value">
                                {formatDate(task.scheduledDate)} {task.scheduledStartTime}
                                {task.scheduledEndTime && ` - ${task.scheduledEndTime}`}
                                {task.duration && ` (${task.duration}分)`}
                            </div>
                        </div>
                    )}

                    {task.notes && (
                        <div className="modal-field">
                            <div className="modal-field-label">備考</div>
                            <div className="modal-field-value">{task.notes}</div>
                        </div>
                    )}

                    <div className="modal-field">
                        <div className="modal-field-label">登録日時</div>
                        <div className="modal-field-value">
                            {new Date(task.createdAt).toLocaleString('ja-JP')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
