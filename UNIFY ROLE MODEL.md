# Unify Role Model: ADMIN, MEMBER, VIEWER

**Status:** 📋 PLANNED  
**Target Duration:** 6-8 hours  
**Priority:** High - Improves UX and reduces confusion  
**Owner:** (TBD)  
**Created:** December 10, 2025

---

## Executive Summary

This implementation plan outlines the migration from a dual-role model (`UserRole`: ADMIN/CONTRIBUTOR/READER and `TenantRole`: ADMIN/MEMBER/VIEWER) to a **unified, single role model** (`ADMIN`, `MEMBER`, `VIEWER`) used consistently across both user-level and tenant-level contexts.

### Problem Statement

**Current State (Confusing)**
- Users have global roles: `ADMIN`, `CONTRIBUTOR`, `READER`
- Tenants have per-tenant roles: `ADMIN`, `MEMBER`, `VIEWER`
- Same permission levels have different names (e.g., `CONTRIBUTOR` vs `MEMBER` both mean "can add content")
- Confuses users, developers, and makes documentation harder

**Target State (Clear)**
- Users and tenants use the same role model: `ADMIN`, `MEMBER`, `VIEWER`
- Consistent naming across the entire application
- Clear semantics:
  - `ADMIN`: Full control (create, edit, delete, manage users)
  - `MEMBER`: Can add/edit content they own
  - `VIEWER`: Read-only access

### Benefits
✅ Reduced confusion for users and developers  
✅ Simplified permission checking logic  
✅ Consistent UI/UX across the application  
✅ Easier onboarding and documentation  
✅ Fewer edge cases and bugs  

---

## Phase Structure

```
Phase 1: Identify All References (1-2 hr)
  ↓
Phase 2: Update GraphQL Schema (30 min)
  ↓
Phase 3: Update Backend Code (2-3 hr)
  ↓
Phase 4: Update Frontend Code (1-2 hr)
  ↓
Phase 5: Update BFF Code (1 hr)
  ↓
Phase 6: Update Tests (1-2 hr)
  ↓
Phase 7: Update Documentation (1-2 hr)
  ↓
Phase 8: Verify & Test (1-2 hr)
```

---

## Phase 1: Identify All References (1-2 hours)

### Task 1.1: Find All CONTRIBUTOR References
**Objective:** Locate every occurrence of `CONTRIBUTOR` in the codebase

**Files to search:**
- `packages/backend/src/schema.graphql`
- `packages/backend/src/**/*.ts`
- `packages/bff/src/**/*.ts`
- `packages/frontend/src/**/*.tsx`
- `packages/frontend/src/**/*.ts`
- Documentation files

**Commands:**
```bash
grep -r "CONTRIBUTOR" packages/ docs/ --include="*.ts" --include="*.tsx" --include="*.graphql" --include="*.md"
```

**Expected Findings:**
- `enum UserRole { ADMIN, CONTRIBUTOR, READER }` in schema.graphql
- Backend resolvers handling UserRole
- Frontend components displaying/selecting user roles
- Database migrations (if applicable)
- Tests

### Task 1.2: Find All READER References
**Objective:** Locate every occurrence of `READER` in the codebase

**Commands:**
```bash
grep -r "READER" packages/ docs/ --include="*.ts" --include="*.tsx" --include="*.graphql" --include="*.md"
```

**Expected Findings:**
- `enum UserRole { ADMIN, CONTRIBUTOR, READER }` in schema.graphql
- Backend resolvers with READER role checks
- Frontend components with READER role logic
- Documentation and comments

### Task 1.3: Document Current Role Usage
**Objective:** Create a comprehensive mapping of where each role is used

**Document to create:** `ROLE_MIGRATION_REFERENCES.md`

**Contents:**
```markdown
## CONTRIBUTOR References
- Location: file path, line number
- Context: brief description of usage
- Type: enum definition / role check / UI component / etc.
- Impact: what needs to change

## READER References
- (same structure)

## MEMBER References (for comparison)
- (already correct, show what we're moving towards)

## Files Affected
- List all files that need updates
```

### Task 1.4: Verify Consistency
**Objective:** Check if TenantRole is already using ADMIN, MEMBER, VIEWER

**Verification:**
```bash
grep -A 5 "enum TenantRole" packages/backend/src/schema.graphql
```

**Expected Result:**
```graphql
enum TenantRole {
  ADMIN
  MEMBER
  VIEWER
}
```

**Success Criteria:**
✅ All CONTRIBUTOR occurrences documented  
✅ All READER occurrences documented  
✅ TenantRole confirmed as ADMIN/MEMBER/VIEWER  
✅ Complete list of affected files created  

---

## Phase 2: Update GraphQL Schema (30 minutes)

### Task 2.1: Update UserRole Enum
**File:** `packages/backend/src/schema.graphql`

**Location:** Lines 110-114 (approximately)

**Current:**
```graphql
enum UserRole {
  ADMIN
  CONTRIBUTOR
  READER
}
```

**New:**
```graphql
enum UserRole {
  ADMIN
  MEMBER
  VIEWER
}
```

**Impact:**
- ✅ Aligns UserRole with TenantRole
- ✅ Makes API contract consistent
- All consumers of this enum must update

### Task 2.2: Update updateUserRole Mutation Comment
**File:** `packages/backend/src/schema.graphql`

**Location:** Mutation `updateUserRole` documentation

**Current:**
```graphql
"""
Update a user's role (admin only).
"""
updateUserRole(userId: ID!, role: UserRole!): User!
```

**New:**
```graphql
"""
Update a user's role to ADMIN, MEMBER, or VIEWER (admin only).
ADMIN: Full application control
MEMBER: Can create and manage own records
VIEWER: Read-only access
"""
updateUserRole(userId: ID!, role: UserRole!): User!
```

### Task 2.3: Add Documentation Comment to UserRole Enum
**File:** `packages/backend/src/schema.graphql`

**Before UserRole enum, add:**
```graphql
"""
User role in the application.
- ADMIN: Full control over the application and all tenants
- MEMBER: Can create and manage their own content
- VIEWER: Read-only access
"""
enum UserRole {
  ADMIN
  MEMBER
  VIEWER
}
```

**Success Criteria:**
✅ UserRole enum updated to ADMIN/MEMBER/VIEWER  
✅ Documentation comments added  
✅ GraphQL schema validates without errors  

---

## Phase 3: Update Backend Code (2-3 hours)

### Task 3.1: Update Type Definitions
**File:** `packages/backend/src/types/user.ts` (or similar)

**Objective:** Update any TypeScript enum definitions that mirror the GraphQL schema

**Changes:**
```typescript
// OLD
export enum UserRole {
  ADMIN = 'ADMIN',
  CONTRIBUTOR = 'CONTRIBUTOR',
  READER = 'READER',
}

// NEW
export enum UserRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}
```

**Files to update:**
- `packages/backend/src/types/user.ts` (or wherever UserRole is defined)
- Any other type definition files that reference UserRole

### Task 3.2: Update Resolvers - updateUserRole
**File:** `packages/backend/src/graphql/resolvers.ts`

**Objective:** Update the updateUserRole resolver to handle new role values

**Current Logic (example):**
```typescript
updateUserRole: async (_, { userId, role }, context) => {
  // Validate role
  if (!['ADMIN', 'CONTRIBUTOR', 'READER'].includes(role)) {
    throw new Error('Invalid role');
  }
  // ... update logic
}
```

**New Logic:**
```typescript
updateUserRole: async (_, { userId, role }, context) => {
  // Validate role
  if (!['ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
    throw new Error('Invalid role: must be ADMIN, MEMBER, or VIEWER');
  }
  // ... update logic
}
```

### Task 3.3: Update Permission Checks
**File:** `packages/backend/src/services/permissions.ts` (or similar)

**Objective:** Update all role-based permission checks

**Example Changes:**
```typescript
// OLD
export function canCreateRecord(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'CONTRIBUTOR';
}

export function canDeleteRecord(role: UserRole, recordOwnerId: string, userId: string): boolean {
  return role === 'ADMIN' || (role === 'CONTRIBUTOR' && recordOwnerId === userId);
}

// NEW
export function canCreateRecord(role: UserRole | TenantRole): boolean {
  return role === 'ADMIN' || role === 'MEMBER';
}

export function canDeleteRecord(role: UserRole | TenantRole, recordOwnerId: string, userId: string): boolean {
  return role === 'ADMIN' || (role === 'MEMBER' && recordOwnerId === userId);
}

export function canViewRecord(role: UserRole | TenantRole): boolean {
  return ['ADMIN', 'MEMBER', 'VIEWER'].includes(role);
}
```

### Task 3.4: Update User Seeding/Fixtures
**Files:**
- `packages/backend/src/seeds/` (if exists)
- `packages/backend/tests/fixtures/` (if exists)

**Objective:** Update test data and seeding scripts

**Changes:**
```typescript
// OLD
const users = [
  { id: '1', role: 'ADMIN' },
  { id: '2', role: 'CONTRIBUTOR' },
  { id: '3', role: 'READER' },
];

// NEW
const users = [
  { id: '1', role: 'ADMIN' },
  { id: '2', role: 'MEMBER' },
  { id: '3', role: 'VIEWER' },
];
```

### Task 3.5: Update Database Migrations (if needed)
**Objective:** Create migration to update existing user roles in database

**Files:**
- `packages/backend/src/migrations/` (if using a migration tool)

**If no migration tool exists, create a script:**
```typescript
// packages/backend/src/migrations/migrate-user-roles.ts
export async function migrateUserRoles(db: MongoClient) {
  const usersCollection = db.collection('users');
  
  // CONTRIBUTOR -> MEMBER
  await usersCollection.updateMany(
    { role: 'CONTRIBUTOR' },
    { $set: { role: 'MEMBER' } }
  );
  
  // READER -> VIEWER
  await usersCollection.updateMany(
    { role: 'READER' },
    { $set: { role: 'VIEWER' } }
  );
  
  console.log('✅ User roles migrated: CONTRIBUTOR → MEMBER, READER → VIEWER');
}
```

**Success Criteria:**
✅ All UserRole enum references updated  
✅ Permission checks refactored  
✅ Type definitions consistent  
✅ Test fixtures/seeds updated  
✅ Migrations created (if applicable)  
✅ Backend builds without errors  

---

## Phase 4: Update Frontend Code (1-2 hours)

### Task 4.1: Update Role Display Components
**Files:**
- `packages/frontend/src/components/Header.tsx` (role badge)
- Any other components displaying user roles

**Changes:**
```typescript
// OLD
const roleColors = {
  ADMIN: 'bg-purple-100 text-purple-800',
  CONTRIBUTOR: 'bg-green-100 text-green-800',
  READER: 'bg-gray-100 text-gray-800',
};

const roleLabel = {
  ADMIN: 'Admin',
  CONTRIBUTOR: 'Contributor',
  READER: 'Viewer',
};

// NEW
const roleColors = {
  ADMIN: 'bg-purple-100 text-purple-800',
  MEMBER: 'bg-green-100 text-green-800',
  VIEWER: 'bg-gray-100 text-gray-800',
};

const roleLabel = {
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};
```

### Task 4.2: Update Role Selection Components
**Files:**
- Any components that allow selecting a role (e.g., invite user, update role dialogs)

**Changes:**
```typescript
// OLD
const roleOptions = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'CONTRIBUTOR', label: 'Contributor' },
  { value: 'READER', label: 'Viewer' },
];

// NEW
const roleOptions = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Member' },
  { value: 'VIEWER', label: 'Viewer' },
];
```

### Task 4.3: Update Role Constants
**File:** `packages/frontend/src/constants/roles.ts` (create if doesn't exist)

**Create or update:**
```typescript
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
} as const;

export const ROLE_LABELS: Record<typeof USER_ROLES[keyof typeof USER_ROLES], string> = {
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<typeof USER_ROLES[keyof typeof USER_ROLES], string> = {
  ADMIN: 'Full control over application and all tenants',
  MEMBER: 'Can create and manage own records',
  VIEWER: 'Read-only access',
};

export const ROLE_COLORS: Record<typeof USER_ROLES[keyof typeof USER_ROLES], string> = {
  ADMIN: 'bg-purple-100 text-purple-800',
  MEMBER: 'bg-green-100 text-green-800',
  VIEWER: 'bg-gray-100 text-gray-800',
};
```

### Task 4.4: Update GraphQL Types (auto-generated)
**Objective:** Regenerate GraphQL client types

**Commands:**
```bash
cd packages/frontend
npm run generate:types  # or similar command for your setup
```

This will automatically update TypeScript types based on the updated schema.

### Task 4.5: Update Test Fixtures
**Files:**
- `packages/frontend/src/__tests__/fixtures/`
- `packages/frontend/src/__tests__/mocks/`

**Changes:**
```typescript
// OLD
export const mockUser = {
  id: '1',
  role: 'CONTRIBUTOR',
};

// NEW
export const mockUser = {
  id: '1',
  role: 'MEMBER',
};
```

**Success Criteria:**
✅ All role display components updated  
✅ Role selection components updated  
✅ Constants file created/updated  
✅ GraphQL types regenerated  
✅ Test fixtures updated  
✅ Frontend builds without errors  

---

## Phase 5: Update BFF Code (1 hour)

### Task 5.1: Update UserRole Type Guards
**File:** `packages/bff/src/auth/types.ts` (or similar)

**Objective:** Update type guards and validation functions

**Changes:**
```typescript
// OLD
export function isValidUserRole(role: string): role is UserRole {
  return ['ADMIN', 'CONTRIBUTOR', 'READER'].includes(role);
}

// NEW
export function isValidUserRole(role: string): role is UserRole {
  return ['ADMIN', 'MEMBER', 'VIEWER'].includes(role);
}
```

### Task 5.2: Update Role Validation in Routes
**Files:**
- `packages/bff/src/routes/` (any routes that validate user roles)

**Changes:**
```typescript
// OLD
if (req.session.user.role !== 'ADMIN' && req.session.user.role !== 'CONTRIBUTOR') {
  return res.status(403).json({ error: 'Forbidden' });
}

// NEW
if (req.session.user.role !== 'ADMIN' && req.session.user.role !== 'MEMBER') {
  return res.status(403).json({ error: 'Forbidden' });
}
```

### Task 5.3: Update Authorization Middleware
**File:** `packages/bff/src/middleware/auth.ts` (or similar)

**Objective:** Update any role-based authorization checks

**Example:**
```typescript
// OLD
export const requireContributor = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.user?.role !== 'ADMIN' && req.session.user?.role !== 'CONTRIBUTOR') {
    return res.status(403).json({ error: 'Contributor or Admin role required' });
  }
  next();
};

// NEW
export const requireMember = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.user?.role !== 'ADMIN' && req.session.user?.role !== 'MEMBER') {
    return res.status(403).json({ error: 'Member or Admin role required' });
  }
  next();
};
```

### Task 5.4: Update Session User Type
**File:** `packages/bff/src/types/session.ts` (or similar)

**Objective:** Update session type definitions

**Changes:**
```typescript
// OLD
declare global {
  namespace Express {
    interface SessionData {
      user: {
        id: string;
        role: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
      };
    }
  }
}

// NEW
declare global {
  namespace Express {
    interface SessionData {
      user: {
        id: string;
        role: 'ADMIN' | 'MEMBER' | 'VIEWER';
      };
    }
  }
}
```

### Task 5.5: Update BFF Test Fixtures
**Files:**
- `packages/bff/src/__tests__/fixtures/`
- `packages/bff/src/__tests__/mocks/`

**Changes:**
```typescript
// OLD
export const mockSessionUser = {
  id: '1',
  role: 'CONTRIBUTOR',
};

// NEW
export const mockSessionUser = {
  id: '1',
  role: 'MEMBER',
};
```

**Success Criteria:**
✅ Type guards updated  
✅ Route validation updated  
✅ Authorization middleware refactored  
✅ Session types updated  
✅ Test fixtures updated  
✅ BFF builds without errors  

---

## Phase 6: Update Tests (1-2 hours)

### Task 6.1: Update Backend Tests
**Files:**
- `packages/backend/src/__tests__/**/*.test.ts`
- `packages/backend/tests/**/*.test.ts`

**Objective:** Update all test cases that reference CONTRIBUTOR or READER

**Example:**
```typescript
// OLD
describe('updateUserRole', () => {
  it('should update user to CONTRIBUTOR role', async () => {
    const result = await updateUserRole(userId, 'CONTRIBUTOR');
    expect(result.role).toBe('CONTRIBUTOR');
  });

  it('should update user to READER role', async () => {
    const result = await updateUserRole(userId, 'READER');
    expect(result.role).toBe('READER');
  });
});

// NEW
describe('updateUserRole', () => {
  it('should update user to MEMBER role', async () => {
    const result = await updateUserRole(userId, 'MEMBER');
    expect(result.role).toBe('MEMBER');
  });

  it('should update user to VIEWER role', async () => {
    const result = await updateUserRole(userId, 'VIEWER');
    expect(result.role).toBe('VIEWER');
  });
});
```

### Task 6.2: Update Permission Tests
**Files:**
- `packages/backend/src/services/__tests__/permissions.test.ts`

**Objective:** Update all permission checking tests

**Example:**
```typescript
// OLD
describe('canCreateRecord', () => {
  it('should allow ADMIN to create record', () => {
    expect(canCreateRecord('ADMIN')).toBe(true);
  });

  it('should allow CONTRIBUTOR to create record', () => {
    expect(canCreateRecord('CONTRIBUTOR')).toBe(true);
  });

  it('should not allow READER to create record', () => {
    expect(canCreateRecord('READER')).toBe(false);
  });
});

// NEW
describe('canCreateRecord', () => {
  it('should allow ADMIN to create record', () => {
    expect(canCreateRecord('ADMIN')).toBe(true);
  });

  it('should allow MEMBER to create record', () => {
    expect(canCreateRecord('MEMBER')).toBe(true);
  });

  it('should not allow VIEWER to create record', () => {
    expect(canCreateRecord('VIEWER')).toBe(false);
  });
});
```

### Task 6.3: Update Frontend Tests
**Files:**
- `packages/frontend/src/__tests__/**/*.test.tsx`

**Objective:** Update React component tests

**Example:**
```typescript
// OLD
it('should display CONTRIBUTOR badge for member', () => {
  render(<Header user={{ role: 'CONTRIBUTOR' }} />);
  expect(screen.getByText('CONTRIBUTOR')).toBeInTheDocument();
});

// NEW
it('should display MEMBER badge for member', () => {
  render(<Header user={{ role: 'MEMBER' }} />);
  expect(screen.getByText('Member')).toBeInTheDocument();
});
```

### Task 6.4: Update Integration Tests
**Files:**
- `packages/bff/src/__tests__/**/*.test.ts`
- Any E2E tests

**Objective:** Update full-stack tests

**Example:**
```typescript
// OLD
it('should update user role to CONTRIBUTOR', async () => {
  const response = await request(app)
    .post('/graphql')
    .send({
      query: 'mutation { updateUserRole(userId: "1", role: CONTRIBUTOR) { role } }',
    });
  expect(response.body.data.updateUserRole.role).toBe('CONTRIBUTOR');
});

// NEW
it('should update user role to MEMBER', async () => {
  const response = await request(app)
    .post('/graphql')
    .send({
      query: 'mutation { updateUserRole(userId: "1", role: MEMBER) { role } }',
    });
  expect(response.body.data.updateUserRole.role).toBe('MEMBER');
});
```

**Success Criteria:**
✅ All backend tests passing  
✅ All frontend tests passing  
✅ All BFF tests passing  
✅ Integration tests passing  
✅ No failing tests due to role changes  

---

## Phase 7: Update Documentation (1-2 hours)

### Task 7.1: Update Architecture.MD
**File:** `Architecture.MD`

**Objective:** Update any references to UserRole in architecture documentation

**Changes:**
- Search for `CONTRIBUTOR` and `READER` mentions
- Update role descriptions to use new names
- Update any diagrams showing user roles
- Example sections to update:
  - Authorization & Permissions section
  - User Roles & Tenants section
  - Any flow diagrams

### Task 7.2: Update Requirements.MD
**File:** `Requirements.MD`

**Objective:** Update functional requirements related to roles

**Changes:**
- FR-* requirements that mention user roles
- Update role descriptions
- Example:
  ```markdown
  // OLD
  **FR-AUTH-ROLES:** The system shall support three user roles:
  - ADMIN: Full application control
  - CONTRIBUTOR: Can create and manage own content
  - READER: Read-only access

  // NEW
  **FR-AUTH-ROLES:** The system shall support three roles (consistent across users and tenants):
  - ADMIN: Full control over the application and all tenants
  - MEMBER: Can create and manage own records and content
  - VIEWER: Read-only access
  ```

### Task 7.3: Update Techstack.MD
**File:** `Techstack.MD`

**Objective:** Update technology stack documentation

**Changes:**
- If there's a section on authentication/authorization
- Update any code examples showing roles
- Update configuration examples

### Task 7.4: Update API Documentation
**Files:**
- `docs/API.md` (if exists)
- `docs/GRAPHQL.md` (if exists)

**Objective:** Update API documentation with new role values

**Example:**
```markdown
// OLD
### User Roles

Users can have one of three roles:
- `ADMIN`
- `CONTRIBUTOR`
- `READER`

// NEW
### User Roles

Users and tenants use the same role model:
- `ADMIN`: Full control
- `MEMBER`: Can create and edit own content
- `VIEWER`: Read-only
```

### Task 7.5: Update Developer Onboarding
**Files:**
- `docs/DEVELOPMENT.md` (if exists)
- `docs/ONBOARDING.md` (if exists)

**Objective:** Update onboarding documentation

**Changes:**
- Update any code examples in quickstart guides
- Update architecture walkthroughs
- Update permission examples

### Task 7.6: Add Migration Guide
**File:** Create `docs/MIGRATION_GUIDES/ROLE_MODEL_UNIFICATION.md`

**Contents:**
```markdown
# Role Model Unification Migration Guide

## Overview

This migration unifies the role model across the application from a dual system (UserRole + TenantRole) to a single unified model.

### What Changed

| Old Name | New Name | Permissions |
|----------|----------|-------------|
| ADMIN | ADMIN | Full control |
| CONTRIBUTOR | MEMBER | Can create/edit own content |
| READER | VIEWER | Read-only |

### For Users

- No action required
- Role names have changed in the UI
- Permissions remain the same

### For Developers

- Update all role comparisons
- Use new role names in code
- Regenerate GraphQL types

### Database Migration

- Automatic on first startup (see migrations/)
- Or run manually: `npm run migrate:roles`

### Troubleshooting

...
```

**Success Criteria:**
✅ All documentation updated  
✅ No stale references to old roles  
✅ Code examples use new role names  
✅ Migration guide created  
✅ Onboarding docs reflect new roles  

---

## Phase 8: Verify & Test (1-2 hours)

### Task 8.1: Build All Packages
**Objective:** Ensure no compilation errors

**Commands:**
```bash
cd c:\github\vinylvault
pnpm build
```

**Expected Result:**
```
✅ packages/backend built successfully
✅ packages/bff built successfully
✅ packages/frontend built successfully
```

**Success Criteria:**
✅ Zero compilation errors  
✅ Zero TypeScript errors  

### Task 8.2: Run All Tests
**Objective:** Ensure no test failures

**Commands:**
```bash
pnpm test
pnpm test:backend
pnpm test:bff
pnpm test:frontend
```

**Expected Result:**
```
✅ All tests passing
✅ Code coverage maintained
```

**Success Criteria:**
✅ 100% of tests passing  
✅ No skipped tests  

### Task 8.3: Lint All Code
**Objective:** Ensure code quality standards

**Commands:**
```bash
pnpm lint
```

**Expected Result:**
```
✅ No linting errors
⚠️  Pre-existing warnings acceptable
```

**Success Criteria:**
✅ No new linting errors introduced  

### Task 8.4: Manual Smoke Test
**Objective:** Test the application end-to-end

**Steps:**
1. Start dev environment: `pnpm dev`
2. Navigate to http://localhost:3000
3. **Test Case 1: User Role Display**
   - Login as admin
   - Verify role badge shows correctly
   - Switch between tenants
   - Verify role badge updates correctly
   
4. **Test Case 2: Create Record**
   - Login as MEMBER
   - Attempt to create a record
   - Verify success
   
5. **Test Case 3: Viewer Access**
   - Create a VIEWER user
   - Login as VIEWER
   - Attempt to create a record
   - Verify failure/no button shown
   
6. **Test Case 4: Admin Control**
   - Login as ADMIN
   - Update a user's role
   - Verify role changes in UI
   - Verify updated role persists on refresh

**Success Criteria:**
✅ All test cases pass  
✅ No console errors  
✅ Roles display correctly  
✅ Permissions enforced correctly  

### Task 8.5: Verify Database Migration
**Objective:** Ensure database update works correctly

**Steps:**
1. Check user documents in database before migration
2. Run migration (automatic or manual)
3. Verify all CONTRIBUTOR → MEMBER conversions
4. Verify all READER → VIEWER conversions
5. Query sample users: `db.users.findOne()`

**Expected Result:**
```json
{
  "_id": ObjectId(...),
  "role": "MEMBER"  // Was CONTRIBUTOR
}
```

**Success Criteria:**
✅ All old roles converted  
✅ No "CONTRIBUTOR" or "READER" values in database  
✅ Data integrity maintained  

### Task 8.6: Grep Final Verification
**Objective:** Ensure no stray references to old roles in code

**Commands:**
```bash
# Should return ZERO results
grep -r "CONTRIBUTOR" packages/ --include="*.ts" --include="*.tsx" --include="*.graphql" | grep -v node_modules | grep -v ".next"
grep -r "READER" packages/ --include="*.ts" --include="*.tsx" --include="*.graphql" | grep -v node_modules | grep -v ".next"

# Should return results in docs only (expected)
grep -r "CONTRIBUTOR\|READER" docs/ --include="*.md"
```

**Expected Result:**
```
# Code (0 matches) ✅
# Docs only (history/migration guide) ✅
```

**Success Criteria:**
✅ Zero code references to old role names  
✅ Only documentation/migration guide references remain  

### Task 8.7: Check GraphQL Introspection
**Objective:** Verify GraphQL schema reflects new roles

**Commands:**
```bash
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __type(name: \"UserRole\") { enumValues { name } } }"}'
```

**Expected Result:**
```json
{
  "data": {
    "__type": {
      "enumValues": [
        { "name": "ADMIN" },
        { "name": "MEMBER" },
        { "name": "VIEWER" }
      ]
    }
  }
}
```

**Success Criteria:**
✅ GraphQL schema shows new role names  
✅ No old role names in schema  

---

## Implementation Checklist

### Phase 1: Identify References
- [ ] Task 1.1: Find all CONTRIBUTOR references
- [ ] Task 1.2: Find all READER references
- [ ] Task 1.3: Document current role usage (ROLE_MIGRATION_REFERENCES.md)
- [ ] Task 1.4: Verify TenantRole consistency

### Phase 2: Update GraphQL Schema
- [ ] Task 2.1: Update UserRole enum
- [ ] Task 2.2: Update updateUserRole mutation comment
- [ ] Task 2.3: Add documentation comment to UserRole enum

### Phase 3: Update Backend Code
- [ ] Task 3.1: Update type definitions
- [ ] Task 3.2: Update resolvers (updateUserRole)
- [ ] Task 3.3: Update permission checks
- [ ] Task 3.4: Update seeding/fixtures
- [ ] Task 3.5: Create database migrations

### Phase 4: Update Frontend Code
- [ ] Task 4.1: Update role display components (Header.tsx, badges)
- [ ] Task 4.2: Update role selection components
- [ ] Task 4.3: Update role constants (new file)
- [ ] Task 4.4: Regenerate GraphQL client types
- [ ] Task 4.5: Update test fixtures

### Phase 5: Update BFF Code
- [ ] Task 5.1: Update UserRole type guards
- [ ] Task 5.2: Update role validation in routes
- [ ] Task 5.3: Update authorization middleware
- [ ] Task 5.4: Update session user type
- [ ] Task 5.5: Update BFF test fixtures

### Phase 6: Update Tests
- [ ] Task 6.1: Update backend tests
- [ ] Task 6.2: Update permission tests
- [ ] Task 6.3: Update frontend tests
- [ ] Task 6.4: Update integration tests

### Phase 7: Update Documentation
- [ ] Task 7.1: Update Architecture.MD
- [ ] Task 7.2: Update Requirements.MD
- [ ] Task 7.3: Update Techstack.MD
- [ ] Task 7.4: Update API documentation
- [ ] Task 7.5: Update developer onboarding
- [ ] Task 7.6: Add migration guide

### Phase 8: Verify & Test
- [ ] Task 8.1: Build all packages
- [ ] Task 8.2: Run all tests
- [ ] Task 8.3: Lint all code
- [ ] Task 8.4: Manual smoke test
- [ ] Task 8.5: Verify database migration
- [ ] Task 8.6: Grep final verification
- [ ] Task 8.7: Check GraphQL introspection

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Breaking change in API | Medium | High | Full test coverage, staged rollout |
| Database migration failure | Low | High | Backup before migration, rollback script |
| UI displaying wrong role | Medium | Medium | Comprehensive UI testing |
| Missing code reference | Medium | Medium | Grep verification, code review |

---

## Rollback Plan

If critical issues are discovered:

1. **Revert commits:** `git revert <commit-hash>`
2. **Rollback database:** `npm run migrate:rollback`
3. **Clear browser cache:** Users clear localStorage
4. **Redeploy previous version**

**Rollback time estimate:** 30-45 minutes

---

## Deployment Strategy

1. **Develop on feature branch:** `feature/unify-role-model`
2. **Internal testing:** All phases 1-8 complete and verified
3. **Code review:** Peer review all changes
4. **Staging deployment:** Test in production-like environment
5. **Production deployment:**
   - Deploy BFF + Backend together
   - Run database migrations
   - Monitor logs for errors
   - User announcement about UI changes

---

## Success Criteria (Overall)

✅ All CONTRIBUTOR/READER references removed from code  
✅ All tests passing (backend, frontend, BFF, integration)  
✅ Build succeeds with no errors or new warnings  
✅ GraphQL schema reflects new roles  
✅ Database migration successful (existing users updated)  
✅ Manual smoke tests all pass  
✅ Documentation updated and current  
✅ No performance degradation  
✅ Grep verification clean (code references only)  

---

## Sign-Off

- **Planned by:** GitHub Copilot
- **Reviewed by:** [Pending]
- **Approved by:** [Pending]
- **Implementation started:** [To be filled]
- **Implementation completed:** [To be filled]

---