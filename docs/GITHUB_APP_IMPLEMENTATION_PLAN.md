# GitHub App Installation Implementation Plan

**Status:** 📋 PLANNED (Phase 6.5)  
**Target Duration:** 4-5 days  
**Priority:** High - Improves UX and security  
**Owner:** (TBD)

---

## Executive Summary

This document provides a comprehensive phased implementation plan for integrating GitHub App-based organization onboarding into Vinyl Vault. The change shifts from automatic GitHub organization sync (passive approach) to explicit user-driven app installation (active approach).

### Problem Statement

**Current Approach (Problematic)**
- On every login, Vinyl Vault automatically queries GitHub for all organizations the user is a member of
- Creates org tenants for every organization, even if user doesn't want Vinyl Vault for that org
- Creates unnecessary database records and can cause permission confusion
- No explicit user intent validation beyond initial OAuth

**Proposed Approach (Better)**
- User explicitly clicks "Add Organization" button
- Gets redirected to GitHub App installation URL
- GitHub displays only organizations where user has installation authority (guarantees permission)
- User clicks "Install"
- GitHub sends webhook + redirect back to app
- Backend creates org tenant for that specific installation
- Org tenant only created when user explicitly wants it

### Business Benefits

| Benefit | Impact |
|---------|--------|
| **Reduced Database Clutter** | Only org tenants user actually uses |
| **Improved Security** | GitHub validates permissions automatically |
| **Better UX** | Explicit action, no surprise tenants |
| **Scalability** | Fewer API calls, less sync logic |
| **Privacy** | System only learns about orgs user installs on |
| **Future Features** | Foundation for "remove org", "org settings" |

---

## Architectural Overview

### System Components

```
┌──────────────────────────────────────────────────────┐
│ Frontend (React/Vite)                                │
│ - "Add Organization" button                          │
│ - Login screen integration                           │
│ - Tenant switcher (existing, unchanged)              │
└────────────────┬─────────────────────────────────────┘
                 │
         ┌───────┴────────┐
         ↓                ↓
    ┌─────────┐     ┌──────────┐
    │ GitHub  │     │ BFF      │
    │ OAuth   │     │ (Express)│
    │ (User   │     ├──────────┤
    │ Auth)   │     │ /auth/*  │
    └─────────┘     │ /webhook │
                    │ /setup   │
         ┌──────────┴──────────┐
         │                     ↓
      (existing)     (new in Phase 6.5)
         
         ┌─────────────────────────┐
         │ Backend (Apollo Server) │
         ├─────────────────────────┤
         │ GraphQL endpoints       │
         │ Tenant creation logic   │
         └────────────┬────────────┘
                      ↓
         ┌────────────────────────┐
         │ MongoDB (Registry DB)  │
         ├────────────────────────┤
         │ users                  │
         │ tenants                │
         │ user_tenant_roles      │
         │ ← installations (NEW)   │
         │ ← user_installation... │
         └────────────────────────┘
```

### Data Flow

```
User clicks "Add Organization"
         │
         ↓
GitHub OAuth (no code change, redirect to GitHub)
         │
    ┌────┴──────────────────┐
    │ GitHub displays orgs  │
    │ (filtered to those    │
    │ user can manage)      │
    └────┬──────────────────┘
         │
    User clicks "Install"
         │
    ┌────┴──────────────────┐
    │ GitHub validates user │
    │ has permission        │
    └────┬──────────────────┘
         │
    ┌────┴──────────────────────────────────┐
    │                                       │
    ↓ (simultaneous)                    ↓
┌─────────────────────┐         ┌──────────────────┐
│ Webhook:            │         │ Browser Redirect │
│ installation.created│         │ /setup?install_  │
│ POST /webhook/github│         │ id=12345         │
│                     │         │                  │
│ → Verify signature  │         │ → Verify session │
│ → Store in DB       │         │ → Link user      │
│ → Return 200 OK     │         │ → Create tenant  │
└─────────────────────┘         │ → Redirect home  │
                                └──────────────────┘
         │
         └────────────┬─────────────────────┘
                      ↓
            Org tenant now available
            in tenant switcher
```

---

## Detailed Implementation Phases

### Phase A: Preparation & Setup (1 day)

**Objectives:**
- Set up GitHub App in GitHub developer console
- Configure environment variables
- Create database schema

**Tasks:**

#### A1: GitHub App Registration
**Location:** GitHub Developer Console  
**Action:** Create new GitHub App with:
- App name: "Vinyl Vault" (or similar)
- Description: "Manage your vinyl collection in organizations"
- Permissions:
  - Read access to org members, organization projects
  - NO repository access needed for basic install
- Webhook: Enable with your domain
  - Webhook URL: `https://vinyl-vault.example.com/webhook/github`
  - Secret: Generate and save securely

**Deliverable:** 
- App ID (e.g., 12345)
- Private key (PEM format)
- Webhook secret
- App slug (for installation URL)

#### A2: Environment Configuration
**Files:**
- `.env.sample`
- `packages/bff/src/config/env.ts`

**Actions:**
1. Add to `.env.sample`:
```bash
# GitHub App Configuration
GITHUB_APP_ID=<app-id>
GITHUB_APP_PRIVATE_KEY=<private-key-content>
GITHUB_APP_WEBHOOK_SECRET=<webhook-secret>
GITHUB_APP_INSTALLATION_URL=https://github.com/apps/vinyl-vault/installations/new
```

2. Update `packages/bff/src/config/env.ts`:
```typescript
export const githubAppId = process.env.GITHUB_APP_ID;
export const githubAppPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;
export const githubAppWebhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;
export const githubAppInstallationUrl = process.env.GITHUB_APP_INSTALLATION_URL;
```

**Verification:**
- [ ] `.env` file contains all variables
- [ ] `env.ts` reads all variables without errors
- [ ] No undefined variable warnings in console

### Phase B: Database Schema (1 day)

**Objectives:**
- Create new database collections for installations
- Add indexes for efficient querying

**Tasks:**

#### B1: Create `installations` Collection
**Location:** `packages/backend/src/db/registry.ts`

**Schema:**
```javascript
db.createCollection('installations', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['installation_id', 'account_login', 'account_type'],
      properties: {
        installation_id: {
          bsonType: 'int',
          description: 'GitHub installation ID (unique)'
        },
        account_login: {
          bsonType: 'string',
          description: 'Organization name'
        },
        account_type: {
          enum: ['User', 'Organization'],
          description: 'GitHub account type'
        },
        account_id: {
          bsonType: 'int',
          description: 'GitHub account ID'
        },
        repositories_count: {
          bsonType: ['int', 'null'],
          description: 'Number of accessible repositories'
        },
        created_at: {
          bsonType: 'date',
          description: 'When app was installed'
        },
        updated_at: {
          bsonType: 'date',
          description: 'Last update timestamp'
        },
        installed_by_user_id: {
          bsonType: 'string',
          description: 'Local user ID who installed'
        },
        installed_at: {
          bsonType: 'date',
          description: 'When this local user installed'
        }
      }
    }
  }
});

// Create indexes
db.collection('installations').createIndex({ installation_id: 1 }, { unique: true });
db.collection('installations').createIndex({ account_login: 1 });
db.collection('installations').createIndex({ installed_by_user_id: 1 });
```

#### B2: Create `user_installation_roles` Collection
**Location:** `packages/backend/src/db/registry.ts`

**Schema:**
```javascript
db.createCollection('user_installation_roles', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_id', 'installation_id', 'org_name'],
      properties: {
        user_id: {
          bsonType: 'string',
          description: 'Local user ID'
        },
        installation_id: {
          bsonType: 'int',
          description: 'GitHub installation ID'
        },
        org_name: {
          bsonType: 'string',
          description: 'Organization name (denormalized)'
        },
        role: {
          enum: ['OWNER', 'MANAGER'],
          description: 'User\'s GitHub organization role'
        },
        created_at: {
          bsonType: 'date',
          description: 'When user was linked to installation'
        }
      }
    }
  }
});

// Create indexes
db.collection('user_installation_roles')
  .createIndex({ user_id: 1, installation_id: 1 }, { unique: true });
db.collection('user_installation_roles')
  .createIndex({ installation_id: 1 });
db.collection('user_installation_roles')
  .createIndex({ org_name: 1 });
```

**Verification:**
- [ ] Collections created in registry database
- [ ] Indexes created successfully
- [ ] Validation schemas applied
- [ ] Can insert test documents

### Phase C: Webhook Endpoint Implementation (1 day)

**Objectives:**
- Create webhook handler
- Implement signature validation
- Store installation events

**Tasks:**

#### C1: Webhook Handler Module
**File:** `packages/bff/src/auth/webhook.ts` (NEW)

**Key Functions:**
```typescript
/**
 * Verify GitHub webhook signature using HMAC-SHA256
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean

/**
 * Handle installation.created event
 */
export async function handleInstallationCreated(
  event: GitHubWebhookEvent,
  registryDb: Db
): Promise<void>

/**
 * Handle installation.deleted event
 */
export async function handleInstallationDeleted(
  event: GitHubWebhookEvent,
  registryDb: Db
): Promise<void>
```

#### C2: Express Route Setup
**File:** `packages/bff/src/index.ts` (extend)

**Route:**
```typescript
app.post('/webhook/github', 
  express.raw({ type: 'application/json' }), 
  async (req, res) => {
    // 1. Get signature from headers
    // 2. Verify signature
    // 3. Parse payload
    // 4. Handle event based on action
    // 5. Return 200 OK
  }
);
```

**Error Handling:**
- Invalid signature: Return 401
- Invalid payload: Return 400
- Server error: Return 500
- Unknown event: Return 200 (silent ignore)

**Verification:**
- [ ] Webhook endpoint accessible at `/webhook/github`
- [ ] Valid signatures accepted
- [ ] Invalid signatures rejected
- [ ] Events stored in database
- [ ] Logs show webhook processing
- [ ] Can receive test webhook from GitHub

### Phase D: Setup Endpoint Implementation (1 day)

**Objectives:**
- Create setup endpoint to handle post-installation redirect
- Link user to installation
- Create organization tenant

**Tasks:**

#### D1: Setup Endpoint Handler
**File:** `packages/bff/src/auth/setup.ts` (NEW)

**Route:** `GET /setup?installation_id=...&setup_action=install`

**Flow:**
1. Validate query parameters
2. Verify user is authenticated (session cookie)
3. Lookup installation record
4. Link user to installation
5. Create org tenant in backend
6. Add user as ADMIN of tenant
7. Update session with new tenant
8. Redirect to frontend

**Error Cases:**
- Not authenticated → Redirect to login
- Invalid installation_id → 400 error
- Installation not found → 404 error
- Backend failure → 500 error with message

#### D2: Backend Tenant Creation Extension
**File:** `packages/backend/src/services/tenants.ts` (extend)

**Update `createOrganizationTenant` to:**
- Accept optional `installationId` parameter
- Store installation link in tenant record
- Prevent duplicate org tenants

#### D3: Session Update
**File:** `packages/bff/src/types/session.ts` (extend)

**Update session structure:**
```typescript
interface Session extends Express.Session {
  userId: string;
  availableTenants: Array<{
    tenantId: string;
    tenantName: string;
    tenantType: 'USER' | 'ORGANIZATION';
    userRole: 'ADMIN' | 'MEMBER' | 'VIEWER';
    installationId?: number; // NEW - link to GitHub installation
  }>;
  // ... other fields
}
```

**Verification:**
- [ ] Setup endpoint accessible
- [ ] Validates authentication
- [ ] Creates installation link
- [ ] Creates org tenant
- [ ] Updates session
- [ ] Redirects correctly
- [ ] New tenant appears in switcher

### Phase E: Frontend Integration (1 day)

**Objectives:**
- Add "Add Organization" button to UI
- Link to GitHub App installation URL
- Show success/error messages

**Tasks:**

#### E1: Add Organization Button Component
**File:** `packages/frontend/src/components/AddOrgButton.tsx` (NEW)

**Features:**
- Clear messaging: "Add Organization"
- Tooltip explaining what it does
- Icon (optional): GitHub icon or plus icon
- Links to GitHub App installation URL
- Disabled state if already loading

**Styling:**
- Accessible
- Responsive
- Dark mode support
- Matches existing UI

#### E2: Login Screen Integration
**File:** `packages/frontend/src/pages/LoginPage.tsx` (or similar)

**Changes:**
- Add AddOrgButton alongside "Sign in with GitHub"
- Show after user is authenticated (separate flow)
- Or show on welcome screen before login

**Option 1: Pre-login (Less preferred)**
- Shows before user logs in
- User redirected to GitHub
- After auth, redirected back to setup

**Option 2: Post-login (More preferred)**
- User logs in first
- Then clicks "Add Organization"
- Cleaner flow, fewer redirects

#### E3: Success Message Handling
**File:** `packages/frontend/src/components/OrgInstalledNotification.tsx` (NEW)

**Features:**
- Detect `?org_installed=<name>` query param
- Show success message
- Close button
- Auto-hide after 5 seconds
- Icon and styling

#### E4: Error Handling
**File:** `packages/frontend/src/pages/SetupError.tsx` (NEW)

**Features:**
- Display error message from `/setup` endpoint
- Retry button
- Link back to login

**Verification:**
- [ ] Button renders correctly
- [ ] Button links to correct GitHub URL
- [ ] Success message appears after install
- [ ] Error handling works
- [ ] Mobile responsive
- [ ] Dark mode works

### Phase F: Testing & Verification (0.5 days)

**Objectives:**
- Comprehensive testing of all components
- Integration testing
- Edge case handling

**Test Categories:**

#### F1: Unit Tests

**Webhook Signature Validation:**
- [ ] Valid signature accepted
- [ ] Invalid signature rejected
- [ ] Malformed signature rejected
- [ ] Missing signature rejected

**Installation Storage:**
- [ ] Webhook payload stored correctly
- [ ] Installation ID unique constraint
- [ ] Timestamp handling
- [ ] Duplicate handling

**Setup Endpoint:**
- [ ] Valid installation ID works
- [ ] Invalid installation ID 404s
- [ ] Missing installation_id 400s
- [ ] Not authenticated redirects to login
- [ ] Successful setup redirects home

#### F2: Integration Tests

**Full Installation Flow:**
- [ ] User installs on org
- [ ] Webhook received and processed
- [ ] Setup endpoint called
- [ ] Org tenant created
- [ ] User added as ADMIN
- [ ] Tenant appears in switcher
- [ ] Session updated

**Multiple Users:**
- [ ] Two users can install on same org
- [ ] User A sees org in switcher
- [ ] User B sees org in switcher
- [ ] Both are ADMIN

**Error Scenarios:**
- [ ] Network error during setup
- [ ] GitHub temporarily unavailable
- [ ] Backend error during tenant creation
- [ ] Session expired during setup

#### F3: Manual Testing

**Real GitHub App Installation:**
- [ ] Create test GitHub org
- [ ] Install app on test org
- [ ] Verify webhook received
- [ ] Verify setup endpoint works
- [ ] Verify tenant created
- [ ] Verify switcher updated
- [ ] Verify can switch to org tenant

**UI Testing:**
- [ ] Button visible on login screen
- [ ] Button directs to GitHub
- [ ] Success message appears
- [ ] Error message appears
- [ ] Mobile UI works
- [ ] Accessibility OK (keyboard nav, screen reader)

#### F4: Edge Cases

**Webhook:**
- [ ] Replayed webhook handled safely
- [ ] Partial payload handled
- [ ] Invalid JSON handled
- [ ] Timeout handled

**Setup:**
- [ ] Installation deleted before setup
- [ ] User deleted before setup
- [ ] Session expired during setup
- [ ] Multiple concurrent setups

**Verification:**
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing checklist complete
- [ ] No TypeScript errors
- [ ] Lint passes
- [ ] No console errors
- [ ] Keyboard accessibility verified
- [ ] Dark mode verified

---

## Implementation Timeline

### Week 1

**Day 1 (Phase A):**
- Register GitHub App
- Configure environment
- Task estimate: 4 hours
- Owner: DevOps/Backend

**Day 2 (Phase B):**
- Create database collections
- Add indexes
- Write migration if needed
- Task estimate: 3 hours
- Owner: Backend

**Day 3 (Phase C):**
- Implement webhook handler
- Add Express route
- Testing webhook signature
- Task estimate: 4 hours
- Owner: Backend

**Day 4 (Phase D):**
- Implement setup endpoint
- Update tenant creation logic
- Session handling
- Task estimate: 4 hours
- Owner: Backend

**Day 5 (Phase E):**
- Frontend button component
- Login integration
- Success message handling
- Task estimate: 4 hours
- Owner: Frontend

### Week 2

**Day 6-7 (Phase F):**
- Unit testing
- Integration testing
- Manual testing
- Bug fixes
- Task estimate: 8 hours
- Owner: Full team

**Day 8:**
- Code review
- Documentation
- Deployment prep
- Task estimate: 4 hours
- Owner: Lead

### Total Estimate

- **Development:** 4 + 3 + 4 + 4 + 4 = 19 hours
- **Testing:** 8 hours
- **Review & Docs:** 4 hours
- **Buffer (20%):** 7 hours
- **Total:** ~38 hours (4.75 days / 1 week)

---

## Deployment Checklist

### Pre-Deployment (1 day before)

- [ ] All code reviewed and approved
- [ ] All tests passing locally
- [ ] No linting errors
- [ ] GitHub App registered and configured
- [ ] Environment variables set in production
- [ ] Database indexes created
- [ ] Webhook secret configured in GitHub
- [ ] Webhook URL points to correct domain
- [ ] TLS certificate valid
- [ ] Database backups current

### Deployment Day

**1. Pre-flight Checks (30 min)**
- [ ] All team members notified
- [ ] Rollback plan prepared
- [ ] On-call team available
- [ ] Monitoring enabled

**2. Database Migration (15 min)**
- [ ] Create `installations` collection
- [ ] Create `user_installation_roles` collection
- [ ] Create indexes
- [ ] Verify collections created

**3. Backend Deployment (15 min)**
- [ ] Deploy new code
- [ ] Verify services started
- [ ] Check logs for errors
- [ ] Webhook endpoint responding

**4. Frontend Deployment (10 min)**
- [ ] Deploy new UI code
- [ ] Verify assets loaded
- [ ] Check buttons visible

**5. Smoke Tests (15 min)**
- [ ] Can login
- [ ] Can see "Add Organization" button
- [ ] Button links to GitHub
- [ ] Send test webhook
- [ ] Verify webhook received
- [ ] Test setup endpoint

**6. Full Integration Test (15 min)**
- [ ] Install app on test org
- [ ] Verify webhook received
- [ ] Verify setup endpoint works
- [ ] Verify tenant created
- [ ] Verify in tenant switcher

### Post-Deployment (1 day after)

- [ ] Monitor logs for errors
- [ ] Check webhook processing times
- [ ] Review error rates
- [ ] Gather user feedback
- [ ] Document any issues

---

## Rollback Plan

**If Issues Occur:**

1. **Immediate (Minutes):**
   - Disable webhook endpoint (return 503)
   - Keep backend/frontend running
   - Users can still use existing tenants

2. **Short-term (Hours):**
   - Revert backend code
   - Keep frontend as-is (button doesn't hurt)
   - Delete corrupted collections if needed

3. **Documentation:**
   - Document issue in incident report
   - List affected users
   - Plan fix for next iteration

---

## Success Criteria

### Technical

- [ ] All tests passing (unit, integration, manual)
- [ ] Zero TypeScript errors
- [ ] Lint clean
- [ ] No console errors
- [ ] Webhook signature validation works
- [ ] Database queries efficient (< 100ms)
- [ ] Setup endpoint responds in < 2 seconds
- [ ] No memory leaks under load

### Functional

- [ ] User can install app on GitHub org
- [ ] Webhook received within 5 seconds
- [ ] Org tenant created automatically
- [ ] User added as ADMIN
- [ ] Tenant appears in switcher
- [ ] Can switch to new tenant
- [ ] Can access org data

### User Experience

- [ ] Clear messaging on button ("Add Organization")
- [ ] Success message after install
- [ ] Error messages helpful and clear
- [ ] Mobile responsive
- [ ] Dark mode support
- [ ] Accessible (keyboard, screen reader)
- [ ] < 3 second end-to-end flow

### Security

- [ ] Webhook signatures verified
- [ ] Only authenticated users can complete setup
- [ ] CSRF protection in place
- [ ] No sensitive data in logs
- [ ] Rate limiting on webhook
- [ ] GitHub App permissions minimal
- [ ] User can't install on org they don't manage

---

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| **GitHub API downtime** | Medium | High | Gracefully handle failures, queue webhooks, retry logic |
| **Webhook missed** | Low | Medium | Setup endpoint calls backend directly as fallback |
| **User installed, session lost** | Low | Low | Graceful redirect to login, can retry |
| **Database lock during creation** | Low | Medium | Connection pooling, transaction handling |
| **Many simultaneous installs** | Low | High | Rate limiting, async processing, queue system |
| **Malformed webhook payload** | Medium | Low | Validate schema, drop invalid events |
| **Security vulnerability** | Low | Critical | Code review, security testing, penetration testing |

---

## Future Enhancements

**Phase 6.5 Extensions (Post-MVP):**

1. **Remove Organization**
   - User can remove org tenant from switcher
   - Uninstall app from GitHub
   - Delete org tenant

2. **Organization Settings**
   - Admin can configure per-org scoring rules
   - Admin can manage team members
   - Admin can view org audit logs

3. **Team Member Sync**
   - Fetch team members from GitHub
   - Update roles based on org membership
   - Auto-remove when user leaves org

4. **OAuth Scopes**
   - Request `admin:org_hook` for webhooks
   - Request `read:org` for membership queries
   - Fine-grained permissions

5. **Webhook Retries**
   - GitHub retries failed webhooks 3 times
   - We should also retry on our side
   - Dead letter queue for failed events

---

## References

**GitHub Documentation:**
- [GitHub Apps](https://docs.github.com/en/developers/apps)
- [Webhooks](https://docs.github.com/en/developers/webhooks-and-events/webhooks)
- [Installation Events](https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#installation)

**Vinyl Vault Documentation:**
- [Architecture.md](Architecture.MD) - System design
- [Techstack.md](Techstack.MD) - Technology choices
- [MULTI_TENANT_IMPLEMENTATION_PLAN.md](MULTI_TENANT_IMPLEMENTATION_PLAN.md) - Phase details

**Related Issues:**
- (Link to GitHub issues if applicable)

---

## Approval & Sign-off

**Phase Owner:** (TBD)  
**Tech Lead Approval:** (TBD)  
**Security Review:** (TBD)  
**Date Approved:** (TBD)  

**Approval Checklist:**
- [ ] Architecture reviewed and approved
- [ ] Security implications reviewed
- [ ] Database schema reviewed
- [ ] No concerns from team
- [ ] Resources allocated
- [ ] Timeline feasible
