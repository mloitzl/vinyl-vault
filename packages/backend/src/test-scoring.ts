/**
 * Test script for the scoring system
 * Run with: pnpm exec tsx src/test-scoring.ts
 */

import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenvConfig({ path: resolve(__dirname, '../../../.env'), debug: false });

import { lookupAndScoreBarcode } from './services/scoring/index.js';

async function test() {
  // Try a few different barcodes
  const testBarcodes = [
    '5099902988313', // Pink Floyd - The Wall (correct barcode)
    '724349710320',  // Beatles - Abbey Road
    '5099962786126', // Queen - Greatest Hits
    '602498616239',  // Nirvana - Nevermind
  ];

  for (const barcode of testBarcodes) {
    console.log(`\nTesting with barcode: ${barcode}`);
    console.log('='.repeat(80));

    try {
      const result = await lookupAndScoreBarcode(barcode);

      console.log('\n📊 RESULTS:');
      console.log(`  Albums found: ${result.albums.length}`);
      console.log(`  Raw releases: ${result.rawReleases.length}`);
      console.log(`  Errors: ${result.errors.length > 0 ? result.errors.join(', ') : 'None'}`);
      console.log(`  Processing time: ${result.processingTimeMs}ms`);

      if (result.albums.length > 0) {
        console.log('\n📀 ALBUMS:');
        for (const album of result.albums) {
          console.log(`\n  [${album.id}]`);
          console.log(`    Artist: ${album.artist}`);
          console.log(`    Title: ${album.title}`);
          console.log(`    Year: ${album.year || 'N/A'}`);
          console.log(`    Score: ${album.primaryReleaseScore}`);
          console.log(`    Primary Source: ${album.primaryReleaseSource}`);
          console.log(`    Tracks: ${album.trackList.length}`);
          console.log(`    Genres: ${album.genres.join(', ') || 'None'}`);
          console.log(`    Styles: ${album.styles.join(', ') || 'None'}`);
          console.log(`    Discogs IDs: ${album.discogsIds.join(', ') || 'None'}`);
          console.log(`    MusicBrainz IDs: ${album.musicbrainzIds.join(', ') || 'None'}`);
          console.log(`    Alternative releases: ${album.alternativeReleases.length}`);
          if (album.alternativeReleases.length > 0) {
            for (const alt of album.alternativeReleases.slice(0, 3)) {
              console.log(`      - ${alt.source}: ${alt.externalId} (score: ${alt.score})`);
            }
            if (album.alternativeReleases.length > 3) {
              console.log(`      ... and ${album.alternativeReleases.length - 3} more`);
            }
          }
        }

        console.log('\n📝 SCORING DETAILS:');
        for (const detail of result.scoringDetails.slice(0, 5)) {
          console.log(`  ${detail.releaseId} (${detail.source}): ${detail.totalScore}`);
          console.log(`    Media: +${detail.mediaTypeScore}, Country: ${detail.countryScore >= 0 ? '+' : ''}${detail.countryScore}, Completeness: +${detail.completenessScore}`);
          if (detail.appliedRules.length > 0) {
            console.log(`    Rules: ${detail.appliedRules.join(', ')}`);
          }
        }
        if (result.scoringDetails.length > 5) {
          console.log(`  ... and ${result.scoringDetails.length - 5} more releases`);
        }

        console.log('\n✅ Found results! Stopping search.');
        break;
      }
    } catch (err: any) {
      console.error('Error:', err.message);
      console.error(err.stack);
    }
  }
}

test();
