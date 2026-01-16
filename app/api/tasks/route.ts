import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const date = searchParams.get('date');
        const status = searchParams.get('status');

        const where: any = {};

        if (date) {
            const targetDate = new Date(date);
            const nextDay = new Date(targetDate);
            nextDay.setDate(nextDay.getDate() + 1);

            where.OR = [
                {
                    requestedDate: {
                        gte: targetDate,
                        lt: nextDay,
                    },
                },
                {
                    scheduledDate: {
                        gte: targetDate,
                        lt: nextDay,
                    },
                },
            ];
        }

        if (status) {
            where.status = status;
        }

        const tasks = await prisma.deliveryTask.findMany({
            where,
            include: {
                ship: true,
                location: true,
            },
            orderBy: [
                { scheduledDate: 'asc' },
                { scheduledStartTime: 'asc' },
                { requestedDate: 'asc' },
                { requestedTime: 'asc' },
            ],
        });

        return NextResponse.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tasks' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const task = await prisma.deliveryTask.create({
            data: {
                shipId: body.shipId || null,
                blockInfo: body.blockInfo || null,
                freeFormTitle: body.freeFormTitle || null,
                requestedDate: new Date(body.requestedDate),
                requestedTime: body.requestedTime,
                locationId: body.locationId,
                notes: body.notes || null,
                status: 'PENDING',
                createdBy: body.createdBy || null,
            },
            include: {
                ship: true,
                location: true,
            },
        });

        return NextResponse.json(task, { status: 201 });
    } catch (error) {
        console.error('Error creating task:', error);
        return NextResponse.json(
            { error: 'Failed to create task' },
            { status: 500 }
        );
    }
}
