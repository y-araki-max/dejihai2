import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json();
        const { id } = params;

        const task = await prisma.deliveryTask.update({
            where: { id },
            data: {
                scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
                scheduledStartTime: body.scheduledStartTime,
                scheduledEndTime: body.scheduledEndTime,
                duration: body.duration,
                locationId: body.locationId,
                specialStatus: body.specialStatus,
                status: body.status,
                notes: body.notes,
                personInCharge: body.personInCharge,
            },
            include: {
                ship: true,
                location: true,
            },
        });

        return NextResponse.json(task);
    } catch (error) {
        console.error('Error updating task:', error);
        return NextResponse.json(
            { error: 'Failed to update task' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        await prisma.deliveryTask.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting task:', error);
        return NextResponse.json(
            { error: 'Failed to delete task' },
            { status: 500 }
        );
    }
}
