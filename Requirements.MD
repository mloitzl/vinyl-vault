# Vinyl Vault – Requirements Specification

## 1. Introduction

### 1.1 Purpose

This document describes the requirements for the Vinyl Vault application, a web-based system to manage a personal vinyl record collection with minimal manual data entry. It is intended for the developer(s) and future maintainers.

### 1.2 Scope

Vinyl Vault lets authenticated users:
- Scan a barcode on a vinyl sleeve.
- Retrieve and store music metadata from external services.
- Manage personal information about each physical record.
- Access the application from the public internet via a Raspberry Pi 5 host.
- Manage collections as individual users or as part of GitHub organizations.
- Switch between personal and organization collections.

External marketplaces, full Discogs collection sync, or mobile native apps are out of scope for this version.

### 1.3 Definitions, Acronyms, Abbreviations

- **BFF**: Backend-for-Frontend proxy (Express + Apollo Server).
- **JWT**: JSON Web Token used between BFF and backend.
- **ADMIN**: User role with full permissions including user management within a tenant.
- **CONTRIBUTOR**: User role with write permissions for own records within a tenant.
- **READER**: User role with read-only permissions within a tenant.
- **Tenant**: An isolated collection scope, either a personal user collection or a GitHub organization collection.
- **Release**: A specific music release (artist, album, etc.).
- **Record**: A physical vinyl owned by a user within a tenant.
- **Session**: HTTP-only cookie-based authentication state.

### 1.4 Stakeholders

- Primary user: Owner of a vinyl collection (admin/contributor).
- Secondary users: Read-only viewers of the collection.
- Operator: The person hosting and maintaining the system on the RPi 5.

## 2. Overall Description

### 2.1 System Context

The system consists of:
- A browser-based React SPA (`packages/frontend`).
- A BFF GraphQL API with session management (`packages/bff`).
- A domain backend GraphQL API with MongoDB (`packages/backend`).
- External services:
  - GitHub OAuth for authentication.
  - Discogs/MusicBrainz for music metadata.

### 2.2 User Roles

- **ADMIN**:
  - Full access within a tenant.
  - Manage all records within the tenant.
  - Assign roles to other users within the tenant.
- **CONTRIBUTOR**:
  - Manage own records within the tenant (create, update, delete).
  - Cannot manage other users.
- **READER**:
  - View records and details within the tenant.
  - No modification capabilities.

*Note: First user to authenticate is automatically assigned ADMIN role for their personal tenant. Organization tenants derive roles from GitHub organization membership.*

## 3. Functional Requirements

FR-1 Barcode Scan and Lookup ✅ IMPLEMENTED
- The system allows the user to input a barcode via:
  - Camera-based scanning (in supported browsers) or
  - Manual text input.
- The system validates the barcode format and shows errors for invalid or unreadable codes.

FR-2 External Metadata Retrieval ✅ IMPLEMENTED
- The system searches for releases by barcode using external music data services (Discogs and MusicBrainz are queried in parallel).
- Results are normalized, scored, and aggregated into Album objects using the blended scoring approach.
- If multiple albums match, the system displays them sorted by score for the user to choose from.
- The system caches release metadata in the tenant's MongoDB database for future reuse.
- Cached releases are isolated per tenant to ensure data security and independence.

### FR-2.1 Release Normalization and Grouping

FR-NG-1: Normalization of textual fields
- The system shall normalize textual metadata fields relevant for release grouping (at least album title and main artist) by:
  a) converting text to lower case,
  b) removing leading/trailing whitespace, and
  c) removing defined non-semantic affixes such as enclosing parentheses used only for edition markers (e.g. "(Remastered)", "(Deluxe Edition)") according to a configurable list.

FR-NG-2: Grouping by album candidate
- The system shall group all releases returned from external services for a given barcode into album candidate groups by using a grouping key that includes at least:
  a) the scanned barcode, and
  b) the normalized album title, and
  c) the normalized main artist.

FR-NG-3: Handling of unique releases
- If a group contains exactly one release, the system shall treat this release as the primary release for this barcode without further disambiguation.

### FR-2.2 Scoring of Releases

FR-SC-1: Scoring function per release
- For each release in a group, the system shall calculate a numeric score based on configurable scoring rules.

FR-SC-2: Media-type preference
- The scoring rules shall allow assigning a positive score contribution if the media type of a release matches a configured preferred media type (e.g. "Vinyl, LP").

FR-SC-3: Country preference
- The scoring rules shall allow assigning a positive or negative score contribution depending on whether the release country is contained in a configured list of preferred countries and/or a list of de-prioritized countries.

FR-SC-4: Metadata completeness
- The scoring rules shall allow assigning a positive score contribution for releases that provide richer metadata, at least considering:
  a) availability of a complete track list, and
  b) availability of cover art information, and
  c) availability of catalog numbers or labels.

FR-SC-5: Selection of primary release
- For each group, the system shall select as the primary release the release with the highest total score.
- If multiple releases share the highest score, the system shall apply a deterministic tie-breaking rule (e.g. earliest release year, smallest external ID) to select exactly one primary release.

### FR-2.3 Aggregation into a Normalized Album Object

FR-AG-1: Creation of Album object
- For each group, the system shall create one normalized Album object representing the album corresponding to that group.

FR-AG-2: Core attributes from primary release
- The system shall populate the following core attributes of the Album object from the selected primary release:
  a) album title,
  b) main artist,
  c) release year,
  d) label (or main label if multiple),
  e) primary format (e.g. "Vinyl, LP"), and
  f) barcode.

FR-AG-3: Preservation of external identifiers
- The system shall store external identifiers in dedicated attributes of the Album object, including:
  a) at least one Discogs release identifier for each Discogs release in the group, and
  b) at least one MusicBrainz release identifier (MBID) for each MusicBrainz release in the group.

FR-AG-4: Representation of alternative releases
- The system shall store all non-primary releases of the group as secondary references inside the Album object, including at least their external identifier, country, year, label, and an optional disambiguation comment if provided by the source.

FR-AG-5: Aggregation of alternative titles and notes
- If secondary releases contain alternative titles or edition notes different from the primary release, the system shall store these values in dedicated collections (e.g. `otherTitles`, `editionNotes`) of the Album object without overwriting the core attributes taken from the primary release.

FR-AG-6: Track list selection
- If the primary release contains a complete track list, the system shall use it as the canonical track list of the Album object.
- If the primary release lacks a complete track list and a secondary release has a more complete track list, the system shall use the most complete available track list while still keeping the original release references.

### FR-2.4 Configuration and Extensibility

FR-CF-1: Configurable scoring parameters
- The system shall allow an administrator to configure scoring parameters (e.g. weights for media type, countries, metadata completeness) without changing the source code.

FR-CF-2: Configurable normalization rules
- The system shall allow an administrator to configure the list of non-semantic affixes to be removed during normalization (e.g. "(Remastered)", "(Deluxe)") without changing the source code.

FR-CF-3: Source-specific rules
- The system shall support defining source-specific rules (e.g. rules applied only to Discogs or only to MusicBrainz releases) for normalization and scoring.

FR-3 Record Creation ✅ IMPLEMENTED
- The system shall allow an ADMIN/CONTRIBUTOR to create a new record by:
  - Selecting a release retrieved from external services or
  - Manually entering basic information if no release is found. 
- The system shall allow the user to add personal attributes such as purchase date, price, condition, location, and notes.
- Implementation: RecordRepository, records service, createRecord mutation (backend), createRecord mutation proxy (BFF), ScanBarcode "Add to Collection" button (frontend).

FR-4 Record Management 🔄 PARTIALLY IMPLEMENTED
- The system shall allow an ADMIN/CONTRIBUTOR to:
  - Update any personal attributes of their records. (Backend implemented, frontend UI pending)
  - Delete records they own. ✅ IMPLEMENTED
- The system shall prevent READER users from creating, updating, or deleting records. ✅ IMPLEMENTED
- Implementation: updateRecord/deleteRecord mutations (backend), mutation proxies with role checks (BFF), deleteRecord with confirmation (frontend CollectionPage), updateRecord frontend UI pending.

FR-5 Collection Browsing ✅ IMPLEMENTED
- The system shall allow users to:
  - List records with pagination. ✅ Cursor-based pagination with "Load More" button
  - Filter records by artist, title, year, format, or location. ✅ Search and location filters implemented
  - Search records using a free-text search field (e.g., artist/title). ✅ MongoDB text search on notes/condition/location
- Implementation: RecordRepository with pagination/filtering, records query (backend), records query proxy (BFF), CollectionPage with RecordCard components (frontend).

FR-6 Authentication via GitHub ✅ IMPLEMENTED
- The system shall authenticate users using GitHub OAuth Web Application Flow.
- The system shall create or update a local user profile based on GitHub identity.
- The system shall not require separate username/password for the application.
- Implementation: `/auth/github`, `/auth/github/callback`, `/auth/me`, `/auth/logout` endpoints.

FR-7 Authorization and Roles ✅ IMPLEMENTED
- The system shall assign each user one role per tenant: ADMIN, CONTRIBUTOR, or READER.
- First authenticated user is automatically assigned ADMIN role for their personal tenant.
- Organization tenants derive user roles from GitHub organization membership.
- The system shall restrict access to mutation operations to ADMIN/CONTRIBUTOR users within the active tenant.
- The system shall enforce role-based access control both in the BFF and backend.
- The system shall enforce tenant isolation to prevent cross-tenant data access.

FR-8 Tenant Management & Switching ✅ IMPLEMENTED
- The system shall allow users to view all tenants they have access to.
- The system shall allow users to switch between personal and organization tenants.
- Tenant switching shall persist across page reloads via session storage.
- The system shall display the current active tenant with user's role within that tenant.
- Switching between tenants shall update JWT token context for backend authorization.

FR-9 GitHub App Installation for Organization Tenants ✅ IMPLEMENTED
- The system provides an "Add Organization" button allowing users to explicitly install Vinyl Vault on GitHub organizations they manage.
- Users can install Vinyl Vault on any GitHub organization where they have installation authority (typically org owners or app managers).
- GitHub validates installation permissions automatically - users cannot install on orgs they don't manage.
- Installation creates a new organization tenant automatically.
- The installing user is automatically assigned ADMIN role in the new organization tenant.
- The system receives and validates GitHub `installation.created` webhook events via `POST /webhook/github`.
- The system verifies webhook signatures using the GitHub app secret (`X-Hub-Signature-256` header).
- The system stores installation metadata (installation_id, account_login, account_type) in the registry database `installations` collection.
- The system links authenticated users to installations via the `user_installation_roles` collection and redirects to `GET /auth/setup?installation_id=...`.
- Only organization tenants for explicitly installed apps are created; automatic org sync on login is disabled.
- Database collections: `installations` (metadata), `user_installation_roles` (user-installation mappings).

FR-10 Session Management ✅ IMPLEMENTED
- The system shall maintain user sessions using HTTP-only cookies between browser and BFF.
- Sessions stored in BFF MongoDB via `connect-mongo`.
- BFF MongoDB is a separate instance from tenant MongoDB databases (not reachable by each other in production).
- BFF MongoDB stores ONLY session information; all tenant data is stored in separate tenant-specific MongoDB databases.
- Session includes current tenant context (tenantId and tenantType).
- Cookie name: `vinylvault.sid`, secure in production, SameSite=lax.
- The system shall not expose backend JWTs or GitHub tokens to the browser.
- The system shall invalidate sessions upon user logout.

FR-10 Tenant Management ✅ IMPLEMENTED
- The system creates a personal tenant (user-type) for each user upon first authentication.
- The system allows users to switch between available tenants (personal and organizations).
- The system enforces strict database-level isolation between tenants.
- Each tenant has its own MongoDB database instance.
- The system tracks user roles per tenant in the registry database `user_tenant_roles` collection.
- Organization tenants are created only when users explicitly install the GitHub App via the "Add Organization" button (not automatic).


FR-9 Auditability (basic) 
- The system shall store creation and update timestamps for records and users. 
- The system shall allow viewing the current role of each user within each tenant.
- The system shall log tenant switches for security auditing.

## 4. Non-Functional Requirements

NFR-1 Security 
- All external access to the system shall use HTTPS. 
- JWTs shall be used only between BFF and backend, with short expiration times.
- JWTs shall include tenant context (tenantId and tenantType) to enforce tenant isolation.
- MongoDB shall not be directly exposed to the public network.
- BFF MongoDB and tenant MongoDB databases are separate instances, not reachable by each other.
- BFF MongoDB stores only session data; all domain data resides in tenant-specific MongoDB databases.
- Each tenant shall have complete database-level isolation with separate MongoDB databases.
- The system shall prevent cross-tenant data access through mandatory tenant validation on all operations.
- OS and dependencies shall be kept up to date with security patches.

NFR-2 Performance 
- The system shall respond to typical user operations (e.g., viewing a record, listing collection) in under 1 second under normal load on the RPi 5. 
- The system shall cache external release data per tenant to reduce repeated external API calls.
- The system shall manage database connections efficiently across multiple tenant databases.
- Tenant database connections shall be pooled and reused where possible to minimize resource consumption.

NFR-3 Usability 
- The UI shall be responsive and usable on mobile and desktop screens. 
- The system shall provide clear feedback for loading, errors, and empty states.

NFR-4 Reliability 
- The system shall be able to restart without manual intervention after a crash (e.g., via systemd or container restart policies). 
- The system shall not lose stored records or releases during restarts (MongoDB persistence).

NFR-5 Maintainability 
- The backend and BFF shall be implemented in TypeScript with a consistent coding style. 
- The architecture shall separate concerns between BFF (auth/proxy) and domain backend (business logic).

NFR-6 Privacy 
- The system shall store only minimal GitHub user data necessary for identification and display. 
- The system shall not store GitHub access tokens long-term; they shall be used only to fetch identity data during login.

### NFR-7 Release Scoring and Aggregation Quality

QR-01: Determinism
- Given the same input releases and configuration, the system shall always select the same primary release and produce the same Album object.

QR-02: Traceability of decisions
- The system shall provide sufficient information (e.g. per-release scores and applied rules) to allow a technically skilled user to understand why a specific primary release was selected for a given barcode.

QR-03: Performance
- For a typical number of releases returned per barcode (assumed up to N releases, configurable), the system shall complete normalization, scoring, and aggregation for one barcode within a time bound that does not negatively impact the overall user experience of adding a record (target: < 500ms after API responses received).

QR-04: Robustness to incomplete data
- The system shall still produce an Album object even if some releases in the group have incomplete metadata, using best-effort scoring and aggregation while not failing the operation.

## 5. Constraints

- The system must run on a single Raspberry Pi 5 in a home network with port forwarding or secure tunneling.
- Only open-source or free-to-use components should be used, excluding paid proprietary dependencies for core functionality.
- External APIs must be used according to their terms of service and rate limits.
- Each tenant shall have a completely separate MongoDB database for strict isolation:
  - BFF MongoDB stores only session information.
  - Each tenant has its own MongoDB database storing users, records, and releases for that tenant.
  - Tenant databases are not reachable by other tenants or the BFF.
  - All tenant-related operations from the BFF must be forwarded to the Backend via GraphQL with tenant context.
- The system must efficiently manage multiple MongoDB database connections on resource-constrained hardware (RPi 5).

## 6. Implementation Status

### Completed
- ✅ Project structure (pnpm monorepo)
- ✅ GitHub OAuth authentication (FR-6)
- ✅ Session management with MongoDB (FR-8)
- ✅ Role-based authorization model (FR-7)
- ✅ User profile display in UI
- ✅ Docker configuration for MongoDB
- ✅ Caddy reverse proxy configuration
- ✅ Barcode scanning UI with camera and manual input (FR-1)
- ✅ External metadata retrieval from Discogs and MusicBrainz (FR-2)
- ✅ Release normalization and grouping (FR-NG-1, FR-NG-2, FR-NG-3)
- ✅ Release scoring mechanism (FR-SC-1 through FR-SC-5)
- ✅ Album aggregation (FR-AG-1 through FR-AG-6)
- ✅ Scoring configuration (FR-CF-1, FR-CF-2, FR-CF-3)
- ✅ Quality requirements (QR-01 through QR-04)
- ✅ GraphQL schemas for BFF and Backend (Relay-friendly)
- ✅ Frontend ScanBarcode component with album display
- ✅ Score breakdown visualization in UI

### In Progress
- 🔄 Record update UI (FR-4) - Backend complete, frontend edit modal/form pending
- ✅ GitHub App Installation for Organization Tenants (FR-9) - Implemented; users can explicitly install app to create org tenants

### Recently Completed
- ✅ Record creation (FR-3) - Full implementation from barcode scan to database storage
- ✅ Record deletion (FR-4) - Backend mutations, BFF proxies with authorization, frontend with confirmation
- ✅ Collection browsing (FR-5) - Paginated list with search/filter, cursor-based pagination, RecordCard components
- ✅ Release caching in MongoDB - Per-tenant release caching with composite ID lookup
- ✅ Multi-tenant statistics - Real-time record and artist counts per tenant
- ✅ Toast notifications - Success/error feedback for user actions

## 7. Open Issues

- Strategy for backup/restore (local NAS, cloud storage, etc.).
- Mobile camera API integration refinements for barcode scanning.
- Full release caching strategy (currently caching is partially disabled to always use live scoring orchestrator).
- Migration strategy for existing org tenants from passive sync to active GitHub App installation (Phase 6.5 planning). - Solved. No production data yet, everything can be deleted.