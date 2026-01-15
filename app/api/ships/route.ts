import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const ships = await prisma.ship.findMany({
            orderBy: { shipNumber: 'desc' },
            include: {
                _count: {
                    select: { blocks: true },
                },
            },
        });

        return NextResponse.json(ships);
    } catch (error) {
        console.error('Error fetching ships:', error);
        return NextResponse.json(
            { error: 'Failed to fetch ships' },
            { status: 500 }
        );
    }
}
