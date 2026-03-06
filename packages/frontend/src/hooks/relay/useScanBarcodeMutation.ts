import { useMutation, graphql } from 'react-relay';
import type { useScanBarcodeMutation as UseScanBarcodeMutationType } from '../../__generated__/useScanBarcodeMutation.graphql';

const ScanBarcodeMutation = graphql`
  mutation useScanBarcodeMutation($barcode: String!) {
    scanBarcode(barcode: $barcode) {
      albums {
        id
        artist
        title
        barcodes
        primaryRelease {
          score
          release {
            id
            barcode
            artist
            title
            year
            format
            label
            country
            coverImageUrl
            externalId
            source
          }
          scoreBreakdown {
            mediaType
            countryPreference
            trackListCompleteness
            coverArt
            labelInfo
            catalogNumber
            yearInfo
            sourceBonus
          }
        }
        alternativeReleases {
          externalId
          source
          country
          year
          format
          label
          score
          editionNote
        }
        trackList {
          position
          title
          duration
        }
        genres
        styles
        externalIds {
          discogs
          musicbrainz
        }
        coverImageUrl
        otherTitles
        editionNotes
        releaseCount
        score
      }
      timing {
        discogsMs
        musicbrainzMs
        scoringMs
        totalMs
      }
      errors
      fromCache
    }
  }
`;

/**
 * Hook to scan a barcode and lookup release candidates.
 * @returns Mutation function and loading state
 */
export function useScanBarcodeMutation() {
  const [commit, isInFlight] = useMutation<UseScanBarcodeMutationType>(ScanBarcodeMutation);

  const mutate = async (barcode: string) => {
    return new Promise((resolve, reject) => {
      commit({
        variables: { barcode },
        onCompleted: (response) => {
          const payload = response.scanBarcode;
          const hasErrors = Boolean(payload.errors && payload.errors.length > 0);
          const hasAlbums = Boolean(payload.albums && payload.albums.length > 0);

          // Source-level errors can be non-fatal when at least one provider returned albums.
          if (hasErrors && !hasAlbums) {
            reject(new Error(payload.errors?.[0] || 'Barcode lookup failed'));
            return;
          }

          resolve(payload);
        },
        onError: reject,
      });
    });
  };

  return { mutate, isLoading: isInFlight };
}
