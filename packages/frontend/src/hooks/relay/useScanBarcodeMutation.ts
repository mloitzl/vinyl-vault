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
          if (response.scanBarcode.errors && response.scanBarcode.errors.length > 0) {
            reject(new Error(response.scanBarcode.errors[0]));
          } else {
            resolve(response.scanBarcode);
          }
        },
        onError: reject,
      });
    });
  };

  return { mutate, isLoading: isInFlight };
}
