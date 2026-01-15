import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const shipId = searchParams.get('shipId');

        if (!shipId) {
            return NextResponse.json(
                { error: 'shipId is required' },
                { status: 400 }
            );
        }

        const blocks = await prisma.block.findMany({
            where: { shipId },
            orderBy: [
                { section: 'asc' },
                { largeBlock: 'asc' },
                { mediumBlock: 'asc' },
            ],
        });

        // Group blocks by section and largeBlock for easier frontend consumption
        const grouped = blocks.reduce((acc, block) => {
            if (!acc[block.section]) {
                acc[block.section] = {};
            }
            if (!acc[block.section][block.largeBlock]) {
                acc[block.section][block.largeBlock] = [];
            }
            acc[block.section][block.largeBlock].push(block.mediumBlock);
            return acc;
        }, {} as Record<string, Record<string, string[]>>);

        return NextResponse.json({ blocks, grouped });
    } catch (error) {
        console.error('Error fetching blocks:', error);
        return NextResponse.json(
            { error: 'Failed to fetch blocks' },
            { status: 500 }
        );
    }
}
