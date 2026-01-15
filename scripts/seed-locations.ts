import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding locations...');

    const locations = [
        { code: '1A1', name: '1A1 定盤', displayOrder: 1 },
        { code: '1A2', name: '1A2 定盤', displayOrder: 2 },
        { code: '1A3', name: '1A3 定盤', displayOrder: 3 },
        { code: '2A1', name: '2A1 定盤', displayOrder: 4 },
        { code: '2A2', name: '2A2 定盤', displayOrder: 5 },
        { code: '2A3', name: '2A3 定盤', displayOrder: 6 },
        { code: '先付', name: '先付', displayOrder: 7 },
        { code: '依頼工事', name: '依頼工事', displayOrder: 8 },
        { code: '連絡事項', name: '連絡事項', displayOrder: 9 },
    ];

    for (const location of locations) {
        await prisma.location.upsert({
            where: { code: location.code },
            update: {},
            create: location,
        });
    }

    console.log(`✅ Created ${locations.length} locations`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
