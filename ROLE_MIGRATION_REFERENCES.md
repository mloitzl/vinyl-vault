# Role Migration References - Comprehensive Analysis

**Created:** December 10, 2025  
**Status:** Phase 1 Complete - Ready for Phases 2-8

---

## Executive Summary

This document consolidates all findings from Phase 1 of the role model unification process. The analysis identifies all references to `CONTRIBUTOR` and `READER` roles that need to be migrated to `MEMBER` and `VIEWER` respectively.

**Key Findings:**
- ✅ TenantRole is already using correct model: `ADMIN`, `MEMBER`, `VIEWER`
- ❌ UserRole is using old model: `ADMIN`, `CONTRIBUTOR`, `READER`
- 📍 4 main files affected in backend, BFF, and frontend packages
- 🔄 Type definitions, GraphQL schemas, services, and resolvers need updates

---

## CONTRIBUTOR References

### 1. Backend - GraphQL Schema
**File:** `packages/backend/src/schema.graphql`  
**Lines:** 108-114  
**Type:** Enum Definition  
**Current:**
```graphql
enum UserRole {
  ADMIN
  CONTRIBUTOR
  READER
}
```

**Impact:** GraphQL API contract - all consumers must update  
**Action Required:** Update to ADMIN, MEMBER, VIEWER

---

### 2. BFF - GraphQL Schema
**File:** `packages/bff/src/schema.graphql`  
**Lines:** 70-74  
**Type:** Enum Definition  
**Current:**
```graphql
enum UserRole {
  ADMIN
  CONTRIBUTOR
  READER
}
```

**Impact:** BFF GraphQL API contract  
**Action Required:** Update to ADMIN, MEMBER, VIEWER

---

### 3. Frontend - Type Definitions
**File:** `packages/frontend/src/types/index.ts`  
**Line:** 9  
**Type:** TypeScript Type Union  
**Current:**
```typescript
role: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
```

**Context:**
```typescript
export interface User {
  id: string;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string;
  role: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
}
```

**Impact:** Frontend User type definition  
**Action Required:** Update to ADMIN, MEMBER, VIEWER

---

### 4. BFF - Session Type Definitions
**File:** `packages/bff/src/types/session.ts`  
**Line:** 13  
**Type:** TypeScript Type Union  
**Current:**
```typescript
role: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
```

**Context:**
```typescript
export interface SessionUser {
  id: string;
  githubId: string;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  role: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
  createdAt: string;
  updatedAt: string;
}
```

**Impact:** Session user type - affects auth flow  
**Action Required:** Update to ADMIN, MEMBER, VIEWER

---

### 5. BFF - Auth GitHub Type Definitions
**File:** `packages/bff/src/auth/github.ts`  
**Line:** 196  
**Type:** TypeScript Type Union  
**Current:**
```typescript
role: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
```

**Impact:** GitHub OAuth authentication flow  
**Action Required:** Update to ADMIN, MEMBER, VIEWER

---

### 6. Backend - Services - User Service Interface
**File:** `packages/backend/src/services/users.ts`  
**Lines:** 14, 34  
**Type:** TypeScript Type Unions in Interfaces  
**Current:**
```typescript
// Line 14
role: 'ADMIN' | 'CONTRIBUTOR' | 'READER';

// Line 34 (User interface)
role: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
```

**Context:** UserDocument and User interfaces  
**Impact:** User service database operations  
**Action Required:** Update to ADMIN, MEMBER, VIEWER

---

### 7. Backend - Services - User Service Logic
**File:** `packages/backend/src/services/users.ts`  
**Line:** 102  
**Type:** Inline Logic  
**Current:**
```typescript
// Create new user - first user becomes ADMIN, others become CONTRIBUTOR
const userCount = await collection.countDocuments();
const role = userCount === 0 ? 'ADMIN' : 'CONTRIBUTOR';
```

**Impact:** New user role assignment logic  
**Action Required:** Update CONTRIBUTOR to MEMBER and update comment

---

### 8. Backend - Services - User Service updateUserRole Function
**File:** `packages/backend/src/services/users.ts`  
**Line:** 123  
**Type:** Function Parameter Type  
**Current:**
```typescript
role: 'ADMIN' | 'CONTRIBUTOR' | 'READER'
```

**Impact:** updateUserRole function signature  
**Action Required:** Update to ADMIN, MEMBER, VIEWER

---

### 9. Backend - GraphQL Resolvers
**File:** `packages/backend/src/graphql/resolvers.ts`  
**Line:** 242  
**Type:** Function Parameter Type  
**Current:**
```typescript
_args: { userId: string; role: 'ADMIN' | 'CONTRIBUTOR' | 'READER' }
```

**Context:** updateUserRole mutation resolver  
**Impact:** GraphQL mutation argument validation  
**Action Required:** Update to ADMIN, MEMBER, VIEWER

---

### 10. BFF - GraphQL Resolvers - Role Mapping Logic
**File:** `packages/bff/src/graphql/resolvers.ts`  
**Lines:** 82  
**Type:** Conditional Logic  
**Current:**
```typescript
const tenantRole =
  ctx.user.role === 'ADMIN'
    ? 'ADMIN'
    : ctx.user.role === 'CONTRIBUTOR'
    ? 'MEMBER'
    : 'VIEWER';
```

**Impact:** Mapping UserRole to TenantRole in JWT  
**Action Required:** Update CONTRIBUTOR check to MEMBER

---

## READER References

### 1. Backend - GraphQL Schema
**File:** `packages/backend/src/schema.graphql`  
**Lines:** 108-114  
**Type:** Enum Definition (same as CONTRIBUTOR)  
**Impact:** GraphQL API contract  
**Action Required:** Update to MEMBER, VIEWER

---

### 2. BFF - GraphQL Schema
**File:** `packages/bff/src/schema.graphql`  
**Lines:** 70-74  
**Type:** Enum Definition (same as CONTRIBUTOR)  
**Impact:** BFF GraphQL API contract  
**Action Required:** Update to MEMBER, VIEWER

---

### 3. Frontend - Type Definitions
**File:** `packages/frontend/src/types/index.ts`  
**Line:** 9 (same line as CONTRIBUTOR)  
**Type:** TypeScript Type Union (same as CONTRIBUTOR)  
**Impact:** Frontend User type definition  
**Action Required:** Update to MEMBER, VIEWER

---

### 4. BFF - Session Type Definitions
**File:** `packages/bff/src/types/session.ts`  
**Line:** 13 (same line as CONTRIBUTOR)  
**Type:** TypeScript Type Union (same as CONTRIBUTOR)  
**Impact:** Session user type  
**Action Required:** Update to MEMBER, VIEWER

---

### 5. BFF - Auth GitHub
**File:** `packages/bff/src/auth/github.ts`  
**Line:** 196 (same line as CONTRIBUTOR)  
**Type:** TypeScript Type Union (same as CONTRIBUTOR)  
**Impact:** GitHub OAuth authentication  
**Action Required:** Update to MEMBER, VIEWER

---

### 6. Backend - Services - Users
**File:** `packages/backend/src/services/users.ts`  
**Lines:** 14, 34 (same lines as CONTRIBUTOR)  
**Type:** TypeScript Type Unions (same as CONTRIBUTOR)  
**Impact:** User service interfaces  
**Action Required:** Update to MEMBER, VIEWER

---

### 7. Backend - Services - Users Type Parameter
**File:** `packages/backend/src/services/users.ts`  
**Line:** 123 (same line as CONTRIBUTOR)  
**Type:** Function Parameter Type (same as CONTRIBUTOR)  
**Impact:** updateUserRole function signature  
**Action Required:** Update to MEMBER, VIEWER

---

### 8. Backend - GraphQL Resolvers
**File:** `packages/backend/src/graphql/resolvers.ts`  
**Line:** 242 (same line as CONTRIBUTOR)  
**Type:** Function Parameter Type (same as CONTRIBUTOR)  
**Impact:** GraphQL mutation argument validation  
**Action Required:** Update to MEMBER, VIEWER

---

### 9. BFF - GraphQL Resolvers - Fallback Logic
**File:** `packages/bff/src/graphql/resolvers.ts`  
**Line:** 82 (same conditional logic as CONTRIBUTOR)  
**Type:** Conditional Logic (same as CONTRIBUTOR)  
**Impact:** Role mapping in JWT  
**Action Required:** Fallback condition updated (READER → VIEWER handled by default)

---

## MEMBER References (Current State - For Comparison)

### TenantRole Already Correct
**Location:** Backend and BFF GraphQL schemas  

**Backend:**
```graphql
enum TenantRole {
  ADMIN
  MEMBER
  VIEWER
}
```

**BFF:**
```graphql
enum TenantRole {
  ADMIN
  MEMBER
  VIEWER
}
```

**Status:** ✅ Already in desired state

---

## Summary of Files Affected

### Backend Package
1. **packages/backend/src/schema.graphql**
   - Update UserRole enum (lines 108-114)
   
2. **packages/backend/src/services/users.ts**
   - Update UserDocument interface (line 14)
   - Update User interface (line 34)
   - Update new user role assignment logic (line 102)
   - Update updateUserRole function parameter (line 123)

3. **packages/backend/src/graphql/resolvers.ts**
   - Update updateUserRole mutation argument type (line 242)

### BFF Package
1. **packages/bff/src/schema.graphql**
   - Update UserRole enum (lines 70-74)

2. **packages/bff/src/types/session.ts**
   - Update SessionUser interface (line 13)

3. **packages/bff/src/auth/github.ts**
   - Update type union in GitHub auth (line 196)

4. **packages/bff/src/graphql/resolvers.ts**
   - Update role mapping logic (line 82)

### Frontend Package
1. **packages/frontend/src/types/index.ts**
   - Update User interface (line 9)

### Documentation/Files to Create
1. **Database Migration Script** (new)
   - Migrate existing CONTRIBUTOR → MEMBER
   - Migrate existing READER → VIEWER

2. **Tests** (search and update)
   - Any test fixtures using old roles
   - Any test assertions checking for old roles

---

## Migration Mapping Summary

| Old Name | New Name | Semantic Meaning |
|----------|----------|------------------|
| ADMIN | ADMIN | Full control (no change) |
| CONTRIBUTOR | MEMBER | Can add/edit own content |
| READER | VIEWER | Read-only access |

---

## TenantRole Verification Results

✅ **CONFIRMED:** TenantRole in both schemas is already using the correct unified model:
- ADMIN: Full control
- MEMBER: Can add/edit content
- VIEWER: Read-only

This is the target model for UserRole, confirming our migration direction is correct.

---

## Implementation Phase Dependencies

| Phase | Dependencies | Critical Path |
|-------|--------------|---------------|
| Phase 2: GraphQL Schema | Phase 1 ✅ | Block until complete |
| Phase 3: Backend Code | Phase 2 | Follows schema update |
| Phase 4: Frontend Code | Phase 2 | Parallel with Phase 3 |
| Phase 5: BFF Code | Phases 2-3 | Follows backend |
| Phase 6: Tests | Phases 3-4 | Follows code updates |
| Phase 7: Documentation | Phases 1-6 | Final documentation |
| Phase 8: Verification | Phases 3-7 | Final validation |

---

## Next Steps

→ **Phase 2: Update GraphQL Schema**
- Update `packages/backend/src/schema.graphql` UserRole enum
- Update `packages/bff/src/schema.graphql` UserRole enum
- Duration: ~30 minutes

---

## Notes

- All references to old roles found in code (not documentation)
- No TypeScript enum definitions found (only type unions)
- BFF has intelligent role mapping logic that correctly maps CONTRIBUTOR → MEMBER
- Database will require migration for existing data
- Frontend and BFF types are tightly coupled and must be updated together

