import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useSendFriendRequestMutation } from '../hooks/relay/useSendFriendRequestMutation.js';
import { useRespondToFriendRequestMutation } from '../hooks/relay/useRespondToFriendRequestMutation.js';
import { useRemoveFriendMutation } from '../hooks/relay/useRemoveFriendMutation.js';
import { executeGraphQLMutation } from '../utils/graphqlExecutor.js';

interface UserResult {
  id: string;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string;
  friendshipStatus?: 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS' | null;
}

interface FriendRequestResult {
  id: string;
  requester: UserResult;
  recipient: UserResult;
  createdAt: string;
}

const SEARCH_USERS_QUERY = `
  query SocialSearchUsers($query: String!) {
    searchUsers(query: $query) {
      id
      githubLogin
      displayName
      avatarUrl
      friendshipStatus
    }
  }
`;

const PENDING_REQUESTS_QUERY = `
  query SocialPendingRequests {
    pendingFriendRequests {
      id
      requester {
        id
        githubLogin
        displayName
        avatarUrl
      }
      recipient {
        id
      }
      createdAt
    }
  }
`;

const SENT_REQUESTS_QUERY = `
  query SocialSentRequests {
    sentFriendRequests {
      id
      recipient {
        id
        githubLogin
        displayName
        avatarUrl
      }
      requester {
        id
      }
      createdAt
    }
  }
`;

const FRIENDS_QUERY = `
  query SocialFriends {
    friends {
      id
      githubLogin
      displayName
      avatarUrl
    }
  }
`;

export function SocialPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [pendingRequests, setPendingRequests] = useState<FriendRequestResult[] | null>(null);
  const [pendingLoading, setPendingLoading] = useState(false);

  const [sentRequests, setSentRequests] = useState<FriendRequestResult[] | null>(null);

  const [friends, setFriends] = useState<UserResult[] | null>(null);
  const [friendsLoading, setFriendsLoading] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);

  const { mutate: sendRequest, isLoading: sendingRequest } = useSendFriendRequestMutation();
  const { mutate: respondToRequest, isLoading: responding } = useRespondToFriendRequestMutation();
  const { mutate: removeFriendMutation, isLoading: removing } = useRemoveFriendMutation();

  const isBusy = sendingRequest || responding || removing;

  // Load pending requests and friends when first visiting the page
  const loadPending = async () => {
    if (pendingRequests !== null) return;
    setPendingLoading(true);
    try {
      const [pendingData, sentData] = await Promise.all([
        executeGraphQLMutation(PENDING_REQUESTS_QUERY, {}),
        executeGraphQLMutation(SENT_REQUESTS_QUERY, {}),
      ]);
      setPendingRequests(pendingData?.pendingFriendRequests ?? []);
      setSentRequests(sentData?.sentFriendRequests ?? []);
    } catch {
      setPendingRequests([]);
      setSentRequests([]);
    } finally {
      setPendingLoading(false);
    }
  };

  const loadFriends = async () => {
    if (friends !== null) return;
    setFriendsLoading(true);
    try {
      const data = await executeGraphQLMutation(FRIENDS_QUERY, {});
      setFriends(data?.friends ?? []);
    } catch {
      setFriends([]);
    } finally {
      setFriendsLoading(false);
    }
  };

  // Load pending requests and friends on mount
  useEffect(() => {
    loadPending();
    loadFriends();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const data = await executeGraphQLMutation(SEARCH_USERS_QUERY, { query: searchQuery.trim() });
      setSearchResults(data?.searchUsers ?? []);
      if ((data?.searchUsers ?? []).length === 0) {
        setSearchError('No user found. They may not allow friend requests.');
      }
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const refreshData = async () => {
    await refreshUser();
    // Reset so they reload fresh
    setPendingRequests(null);
    setSentRequests(null);
    setFriends(null);
    // Reload
    setPendingLoading(true);
    setFriendsLoading(true);
    try {
      const [pendingData, sentData, friendsData] = await Promise.all([
        executeGraphQLMutation(PENDING_REQUESTS_QUERY, {}),
        executeGraphQLMutation(SENT_REQUESTS_QUERY, {}),
        executeGraphQLMutation(FRIENDS_QUERY, {}),
      ]);
      setPendingRequests(pendingData?.pendingFriendRequests ?? []);
      setSentRequests(sentData?.sentFriendRequests ?? []);
      setFriends(friendsData?.friends ?? []);
    } finally {
      setPendingLoading(false);
      setFriendsLoading(false);
    }
  };

  const handleSendRequest = async (githubLogin: string) => {
    setActionError(null);
    try {
      await sendRequest(githubLogin);
      // Optimistically update search result status and reload sent requests from server
      setSearchResults((prev) =>
        prev.map((u) => (u.githubLogin === githubLogin ? { ...u, friendshipStatus: 'PENDING_SENT' } : u))
      );
      // Reload sent requests so the section is up-to-date immediately
      const sentData = await executeGraphQLMutation(SENT_REQUESTS_QUERY, {});
      setSentRequests(sentData?.sentFriendRequests ?? []);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to send request');
    }
  };

  const handleAcceptFromSearch = async (githubLogin: string) => {
    const result = searchResults.find((u) => u.githubLogin === githubLogin);
    if (!result) return;
    // Find the pending request from this person
    const req = pendingRequests?.find((r) => r.requester.id === result.id);
    if (!req) {
      setActionError('No pending request found from this user');
      return;
    }
    setActionError(null);
    try {
      await respondToRequest(req.id, true);
      await refreshData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to accept request');
    }
  };

  const handleRespondToRequest = async (requestId: string, accept: boolean) => {
    setActionError(null);
    try {
      await respondToRequest(requestId, accept);
      await refreshData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to respond to request');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    setActionError(null);
    try {
      await removeFriendMutation(friendId);
      await refreshData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove friend');
    }
  };

  const handleViewCollection = async (friendId: string) => {
    const tenantId = `user_${friendId}`;
    try {
      await executeGraphQLMutation(
        `mutation SocialSwitchTenant($tenantId: String!) { switchTenant(tenantId: $tenantId) { id } }`,
        { tenantId }
      );
      await refreshUser();
      navigate('/collection');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to switch to friend collection');
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-gray-500">Please sign in to use social features.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-gray-900">Friends</h1>
        <p className="text-sm text-gray-500">Find friends and browse their collections</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {actionError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {/* User Search */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Find Users</h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="GitHub username or email"
              className="flex-1"
            />
            <Button type="submit" variant="primary" disabled={searchLoading || !searchQuery.trim()}>
              {searchLoading ? <LoadingSpinner size="sm" /> : 'Search'}
            </Button>
          </form>

          {searchError && !searchLoading && (
            <p className="mt-2 text-sm text-gray-500">{searchError}</p>
          )}

          {searchResults.length > 0 && (
            <ul className="mt-3 space-y-2">
              {searchResults.map((u) => (
                <UserCard
                  key={u.id}
                  user={u}
                  disabled={isBusy}
                  onSendRequest={() => handleSendRequest(u.githubLogin)}
                  onAccept={() => handleAcceptFromSearch(u.githubLogin)}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Pending Requests (incoming) */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Pending Requests</h2>
          {pendingLoading ? (
            <LoadingSpinner size="sm" />
          ) : !pendingRequests || pendingRequests.length === 0 ? (
            <p className="text-sm text-gray-400">No pending requests.</p>
          ) : (
            <ul className="space-y-2">
              {pendingRequests.map((req) => (
                <li key={req.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  <Avatar user={req.requester} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{req.requester.displayName}</p>
                    <p className="text-xs text-gray-500">@{req.requester.githubLogin}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => handleRespondToRequest(req.id, true)}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => handleRespondToRequest(req.id, false)}
                    >
                      Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Sent Requests (outgoing) */}
        {sentRequests && sentRequests.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Sent Requests</h2>
            <ul className="space-y-2">
              {sentRequests.map((req) => (
                <li key={req.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  <Avatar user={req.recipient} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{req.recipient.displayName}</p>
                    <p className="text-xs text-gray-500">@{req.recipient.githubLogin}</p>
                  </div>
                  <span className="text-xs text-gray-400 italic">Awaiting response</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Friends List */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">My Friends</h2>
          {friendsLoading ? (
            <LoadingSpinner size="sm" />
          ) : !friends || friends.length === 0 ? (
            <p className="text-sm text-gray-400">No friends yet. Search for users above!</p>
          ) : (
            <ul className="space-y-2">
              {friends.map((friend) => (
                <li key={friend.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  <Avatar user={friend} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{friend.displayName}</p>
                    <p className="text-xs text-gray-500">@{friend.githubLogin}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => handleViewCollection(friend.id)}
                    >
                      View Collection
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => handleRemoveFriend(friend.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Avatar({ user }: { user: Pick<UserResult, 'avatarUrl' | 'displayName'> }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.displayName}
        className="w-9 h-9 rounded-full flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
      <span className="text-gray-600 text-sm font-medium">
        {user.displayName.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

interface UserCardProps {
  user: UserResult;
  disabled: boolean;
  onSendRequest: () => void;
  onAccept: () => void;
}

function UserCard({ user, disabled, onSendRequest, onAccept }: UserCardProps) {
  const status = user.friendshipStatus;

  return (
    <li className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
      <Avatar user={user} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{user.displayName}</p>
        <p className="text-xs text-gray-500">@{user.githubLogin}</p>
      </div>
      <div>
        {status === 'FRIENDS' && (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
            Friends ✓
          </span>
        )}
        {status === 'PENDING_SENT' && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            Request Sent
          </span>
        )}
        {status === 'PENDING_RECEIVED' && (
          <Button variant="primary" size="sm" disabled={disabled} onClick={onAccept}>
            Accept
          </Button>
        )}
        {(!status || status === 'NONE') && (
          <Button variant="secondary" size="sm" disabled={disabled} onClick={onSendRequest}>
            Add Friend
          </Button>
        )}
      </div>
    </li>
  );
}
