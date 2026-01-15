import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface BlockRow {
    section: string;      // 区画
    largeBlock: string;   // 大組
    mediumBlock: string;  // 中組
}

function parseBlockCSV(filePath: string, shipNumber: string): BlockRow[] {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
        skip_empty_lines: true,
        relax_column_count: true,
    });

    const blocks: BlockRow[] = [];
    let currentSection = '';
    let currentLargeBlock = '';

    // Find the header row (区画,大組,中組)
    let startIndex = 0;
    for (let i = 0; i < records.length; i++) {
        if (records[i][0]?.includes('区画') || records[i][0]?.trim() === '区画') {
            startIndex = i + 2; // Skip header and "ブロック" row
            break;
        }
    }

    for (let i = startIndex; i < records.length; i++) {
        const row = records[i];

        // Skip empty rows or summary rows
        if (!row || row.length === 0) continue;
        if (row[0]?.includes('区画計') || row[0]?.includes('本体区分計')) continue;

        const col0 = (row[0] || '').trim();
        const col1 = (row[1] || '').trim();
        const col2 = (row[2] || '').trim();

        // Forward-fill logic for section (区画)
        if (col0 && col0 !== '　' && !col0.includes('計')) {
            currentSection = col0;
        }

        // Forward-fill logic for large block (大組)
        if (col1 && col1 !== '　') {
            currentLargeBlock = col1;
        }

        // Only add if we have a medium block (中組)
        if (col2 && currentSection && currentLargeBlock) {
            blocks.push({
                section: currentSection,
                largeBlock: currentLargeBlock,
                mediumBlock: col2,
            });
        }
    }

    return blocks;
}

async function main() {
    console.log('Importing block master data from CSV files...');

    const dataDir = path.join(process.cwd(), 'data');
    const csvFiles = [
        { file: 'block_list_S6313.csv', shipNumber: 'S6313' },
        { file: 'block_list_S6300.csv', shipNumber: 'S6300' },
        { file: 'block_list_S6292.csv', shipNumber: 'S6292' },
        { file: 'block_list_S6278.csv', shipNumber: 'S6278' },
    ];

    for (const { file, shipNumber } of csvFiles) {
        const filePath = path.join(dataDir, file);

        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  File not found: ${filePath}`);
            continue;
        }

        console.log(`\nProcessing ${shipNumber}...`);

        // Create or get ship
        const ship = await prisma.ship.upsert({
            where: { shipNumber },
            update: {},
            create: {
                shipNumber,
                name: `工事番号 ${shipNumber}`,
            },
        });

        // Parse CSV
        const blocks = parseBlockCSV(filePath, shipNumber);
        console.log(`  Found ${blocks.length} blocks`);

        // Insert blocks
        let insertedCount = 0;
        for (const block of blocks) {
            try {
                await prisma.block.upsert({
                    where: {
                        shipId_section_largeBlock_mediumBlock: {
                            shipId: ship.id,
                            section: block.section,
                            largeBlock: block.largeBlock,
                            mediumBlock: block.mediumBlock,
                        },
                    },
                    update: {},
                    create: {
                        shipId: ship.id,
                        section: block.section,
                        largeBlock: block.largeBlock,
                        mediumBlock: block.mediumBlock,
                    },
                });
                insertedCount++;
            } catch (error) {
                console.error(`  Error inserting block: ${JSON.stringify(block)}`, error);
            }
        }

        console.log(`  ✅ Inserted ${insertedCount} blocks for ${shipNumber}`);
    }

    console.log('\n✅ Block import completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
