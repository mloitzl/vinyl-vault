// GitHub organization API integration
// Fetches user's organizations and org members from GitHub API

export interface GitHubOrganization {
  id: number;
  login: string;
  name?: string;
  avatarUrl?: string;
  description?: string;
}

export interface GitHubOrgMember {
  id: number;
  login: string;
  name?: string;
  avatarUrl?: string;
}

/**
 * Fetch all organizations that the authenticated user is a member of.
 * Uses pagination to handle users with many organizations.
 * Per-page limit: 100 (GitHub API default).
 *
 * @param accessToken GitHub personal access token or OAuth token
 * @returns Array of organizations or empty array on error
 */
export async function getUserOrganizations(accessToken: string): Promise<GitHubOrganization[]> {
  if (!accessToken) {
    console.warn('[githubOrgs] No access token provided');
    return [];
  }

  const orgs: GitHubOrganization[] = [];
  let page = 1;
  let hasMore = true;

  // fixme: That is not working for some reason. Might be a problem with the token scopes.
  try {
    while (hasMore) {
      const response = await fetch(`https://api.github.com/user/orgs?per_page=100&page=${page}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'VinylVault/1.0',
        },
      });

      // Check rate limiting
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const limit = response.headers.get('X-RateLimit-Limit');
      if (remaining && parseInt(remaining) < 10) {
        console.warn(`[githubOrgs] GitHub API rate limit low: ${remaining}/${limit} remaining`);
      }

      if (!response.ok) {
        if (response.status === 401) {
          console.error('[githubOrgs] GitHub API authentication failed (401)');
        } else if (response.status === 403) {
          console.error('[githubOrgs] GitHub API forbidden (403) - may be rate limited');
        } else {
          console.error(`[githubOrgs] GitHub API error: ${response.status} ${response.statusText}`);
        }
        break;
      }

      const pageOrgs = await response.json();

      if (!Array.isArray(pageOrgs) || pageOrgs.length === 0) {
        hasMore = false;
      } else {
        // Map GitHub API response to our interface
        orgs.push(
          ...pageOrgs.map((org: any) => ({
            id: org.id,
            login: org.login,
            name: org.name,
            avatarUrl: org.avatar_url,
            description: org.description,
          }))
        );

        // Check if there are more pages
        if (pageOrgs.length < 100) {
          hasMore = false;
        } else {
          page += 1;
        }
      }
    }

    console.log(`[githubOrgs] Fetched ${orgs.length} organizations for user`);
    return orgs;
  } catch (error) {
    console.error('[githubOrgs] Error fetching user organizations:', error);
    return [];
  }
}

/**
 * Fetch all members of a GitHub organization.
 * Uses pagination to handle organizations with many members.
 * Per-page limit: 100 (GitHub API default).
 *
 * @param orgName Organization name/login (e.g., "facebook")
 * @param accessToken GitHub personal access token or OAuth token
 * @returns Array of organization members or empty array on error
 */
export async function getOrganizationMembers(
  orgName: string,
  accessToken: string
): Promise<GitHubOrgMember[]> {
  if (!orgName || !accessToken) {
    console.warn('[githubOrgs] Missing orgName or accessToken');
    return [];
  }

  const members: GitHubOrgMember[] = [];
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await fetch(
        `https://api.github.com/orgs/${encodeURIComponent(
          orgName
        )}/members?per_page=100&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'VinylVault/1.0',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[githubOrgs] Organization "${orgName}" not found (404)`);
        } else if (response.status === 401) {
          console.error('[githubOrgs] GitHub API authentication failed (401)');
        } else if (response.status === 403) {
          console.error('[githubOrgs] GitHub API forbidden (403) - may be rate limited');
        } else {
          console.error(`[githubOrgs] GitHub API error: ${response.status} ${response.statusText}`);
        }
        break;
      }

      const pageMembers = await response.json();

      if (!Array.isArray(pageMembers) || pageMembers.length === 0) {
        hasMore = false;
      } else {
        // Map GitHub API response to our interface
        members.push(
          ...pageMembers.map((member: any) => ({
            id: member.id,
            login: member.login,
            name: member.name,
            avatarUrl: member.avatar_url,
          }))
        );

        // Check if there are more pages
        if (pageMembers.length < 100) {
          hasMore = false;
        } else {
          page += 1;
        }
      }
    }

    console.log(`[githubOrgs] Fetched ${members.length} members for organization "${orgName}"`);
    return members;
  } catch (error) {
    console.error(`[githubOrgs] Error fetching members for organization "${orgName}":`, error);
    return [];
  }
}
